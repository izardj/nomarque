import type {
  GodDto,
  ModifierDto,
  NileDto,
  NomeDto,
  NomeStateResponse,
  ParcelDto,
  PendingCardDto,
} from '@nomarque/contracts';
import { GAME_DATA, GODS, type FloodLevel, type God } from '@nomarque/data';
import {
  activeModifiers,
  canAffordEffects,
  catalogOf,
  forecast,
  godStanding,
  NILE_CALENDAR,
  nextBoundary,
  phaseAt,
  realInstantMs,
  reignLengthHours,
  type AdvanceReport,
  type NomeState,
} from '@nomarque/rules';
import { regionToDto } from '../worlds/worlds.mapper';
import type { NomeContext } from './nomes.repository';

export interface NomeView {
  nome: NomeContext;
  /** Game hour the state is computed at. */
  at: number;
  state: NomeState;
  report: AdvanceReport;
}

/**
 * The flood of a Nile year. The instant the reign ends falls on the year after
 * the last one, which keeps the flood of the last.
 */
function floodOf(floods: readonly FloodLevel[], year: number): FloodLevel {
  const flood = floods[Math.min(year, floods.length - 1)];
  if (flood === undefined) {
    throw new Error('The reign has no Nile year.');
  }
  return flood;
}

export function toNomeStateResponse(view: NomeView): NomeStateResponse {
  const { nome, state, at } = view;
  const { yearHours } = GAME_DATA.parameters;
  const catalog = catalogOf(GAME_DATA);
  const iso = (hours: number): string =>
    new Date(realInstantMs(nome.clock, hours)).toISOString();

  const { year, phase, hourOfYear } = phaseAt(at, yearHours);
  const flood = floodOf(nome.floods, year);
  const next = nextBoundary(at, yearHours);
  const outlook = forecast(state, GAME_DATA, at, flood);
  const nile: NileDto = {
    year,
    phase,
    hourOfYear,
    flood,
    nextPhase: next.phase,
    nextPhaseAt: next.at,
    nextPhaseAtIso: iso(next.at),
    nextFlood: nextFloodOf(view),
    cropsLocked: hourOfYear >= NILE_CALENDAR.akhetEndsAt,
  };
  const parcels: ParcelDto[] = state.parcels.map((parcel) => {
    const slot = catalog.slot(parcel.slot);
    const parcelOutlook = outlook.parcels.find((p) => p.slot === parcel.slot);
    return {
      slot: parcel.slot,
      row: slot.row,
      col: slot.col,
      zone: slot.zone,
      building: parcel.building,
      houses: parcel.houses,
      workers: parcel.workers,
      occupancy: parcelOutlook?.occupancy ?? null,
      perYear: parcelOutlook?.perYear ?? {},
      harvest: parcelOutlook?.harvest ?? null,
      buildEndsAt: parcel.buildEndsAt,
      buildEndsAtIso:
        parcel.buildEndsAt === null ? null : iso(parcel.buildEndsAt),
    };
  });
  return {
    nome: {
      id: nome.id,
      name: nome.name,
      region: regionToDto(nome.region),
      dynastyName: nome.dynastyName,
      deben: state.deben,
      favor: state.favor,
      gameHours: at,
      nile,
      stocks: state.stocks,
      capacity: outlook.capacity,
      workforce: outlook.workforce,
      parcels,
      ...rulesFields(view, iso),
      dataVersion: nome.dataVersion,
    },
    report: view.report,
  };
}

/**
 * Flood of the next Nile year once an event card revealed it early and the
 * reveal time has come; there is none after the last year.
 */
function nextFloodOf(view: NomeView): FloodLevel | null {
  const { yearHours } = GAME_DATA.parameters;
  const { state, at, nome } = view;
  const { floodForecastHours } = state.rules;
  const nextYear = phaseAt(at, yearHours).year + 1;
  const flood = nome.floods[nextYear];
  if (
    floodForecastHours <= 0 ||
    flood === undefined ||
    at < nextYear * yearHours - floodForecastHours
  ) {
    return null;
  }
  return flood;
}

/** Gods, offerings, event cards, lasting effects and the end of the reign. */
function rulesFields(
  view: NomeView,
  iso: (hours: number) => string,
): Pick<
  NomeDto,
  | 'gods'
  | 'nextOfferingAt'
  | 'nextOfferingAtIso'
  | 'cards'
  | 'modifiers'
  | 'reign'
> {
  const { state, at } = view;
  const params = GAME_DATA.parameters;
  // One entry per god of GODS.
  const gods = Object.fromEntries(
    GODS.map((god): [God, GodDto] => [
      god,
      {
        favor: state.rules.gods[god],
        standing: godStanding(state, params, god),
      },
    ]),
  ) as Record<God, GodDto>;

  const { lastOfferingAt } = state.rules;
  const offeringAt =
    lastOfferingAt === null
      ? null
      : lastOfferingAt + params.offeringIntervalHours;
  const nextOfferingAt =
    offeringAt !== null && offeringAt > at ? offeringAt : null;

  const cards: PendingCardDto[] = [...state.rules.cards.pending]
    .sort((a, b) => a.drawId - b.drawId)
    .map((pending) => {
      const def = GAME_DATA.cards.find((c) => c.id === pending.cardId);
      if (!def) {
        throw new Error(`Unknown event card ${pending.cardId}.`);
      }
      return {
        drawId: pending.drawId,
        cardId: pending.cardId,
        drawnAt: pending.drawnAt,
        expiresAt: pending.expiresAt,
        expiresAtIso: iso(pending.expiresAt),
        defaultChoice: def.defaultChoice,
        choices: def.choices.map((choice) => ({
          key: choice.key,
          affordable: canAffordEffects(state, choice.effects),
        })),
      };
    });

  const modifiers: ModifierDto[] = [
    ...activeModifiers(state, at),
    ...state.rules.modifiers.filter((m) => m.startsAt > at),
  ]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map((m) => ({
      effect: m.effect,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      endsAtIso: iso(m.endsAt),
    }));

  const endsAt = reignLengthHours(params);
  return {
    gods,
    nextOfferingAt,
    nextOfferingAtIso: nextOfferingAt === null ? null : iso(nextOfferingAt),
    cards,
    modifiers,
    reign: { endsAt, endsAtIso: iso(endsAt), over: at >= endsAt },
  };
}
