import type {
  NileDto,
  NomeStateResponse,
  ParcelDto,
} from '@nomarque/contracts';
import { GAME_DATA, type FloodLevel } from '@nomarque/data';
import {
  catalogOf,
  forecast,
  nextBoundary,
  phaseAt,
  realInstantMs,
  type AdvanceReport,
  type NomeState,
} from '@nomarque/rules';
import { regionToDto } from '../worlds/worlds.mapper';
import type { NomeContext, StoredNome } from './nomes.repository';

export interface NomeView {
  nome: NomeContext;
  favor: StoredNome['favor'];
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
      favor: view.favor,
      gameHours: at,
      nile,
      stocks: state.stocks,
      capacity: outlook.capacity,
      workforce: outlook.workforce,
      parcels,
      dataVersion: nome.dataVersion,
    },
    report: view.report,
  };
}
