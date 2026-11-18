// Player actions on a nome. Each one expects the state already advanced to
// `now` and returns a new state, or the reason it is refused. The server runs
// them after advance(); the client runs them to validate before sending.

import type { BuildingId, CardChoiceKey, GameData, God } from '@nomarque/data';
import { NILE_CALENDAR, phaseAt } from './calendar';
import { applyChoice } from './cards';
import { catalogOf } from './catalog';
import {
  emptyRulesState,
  type HouseLevel,
  type NomeState,
  type ParcelState,
  type RulesContext,
} from './state';

export type ActionError =
  | 'unknown_parcel'
  | 'parcel_not_empty'
  | 'zone_not_allowed'
  | 'not_enough_deben'
  | 'no_building'
  | 'invalid_workers'
  | 'not_a_field'
  | 'crops_locked'
  | 'offering_too_soon'
  | 'not_enough_resources'
  | 'unknown_card'
  | 'unknown_choice'
  | 'cannot_afford';

export type ActionResult =
  { ok: true; state: NomeState } | { ok: false; error: ActionError };

export type BuildTarget =
  { kind: 'building'; building: BuildingId } | { kind: 'houses' };

/** A new nome as laid out by the starting map, every building fully staffed. */
export function foundNome(data: GameData): NomeState {
  const catalog = catalogOf(data);
  const parcels: ParcelState[] = data.map.map((slot) => {
    const parcel: ParcelState = {
      slot: slot.slot,
      building: null,
      houses: null,
      workers: 0,
      buildEndsAt: null,
    };
    if (slot.start?.kind === 'building') {
      parcel.building = slot.start.building;
      parcel.workers = catalog.building(slot.start.building).workers;
    } else if (slot.start?.kind === 'houses') {
      const houseId = slot.start.house;
      const level = data.houses.find((h) => h.id === houseId)?.level;
      if (level === undefined) {
        throw new Error(`unknown starting house on slot ${slot.slot}`);
      }
      parcel.houses = {
        level: level as HouseLevel,
        count: data.parameters.housesPerBlock,
      };
    }
    return parcel;
  });
  return {
    deben: data.parameters.startingDeben,
    favor: 0,
    stocks: { ...data.startingStocks },
    parcels,
    rules: emptyRulesState(data),
  };
}

/** Starts a construction on an empty parcel; it is delivered at now + duration. */
export function build(
  state: NomeState,
  data: GameData,
  slot: number,
  target: BuildTarget,
  now: number,
): ActionResult {
  const catalog = catalogOf(data);
  const index = state.parcels.findIndex((p) => p.slot === slot);
  if (index < 0) {
    return { ok: false, error: 'unknown_parcel' };
  }
  const parcel = state.parcels[index];
  if (parcel.building !== null || parcel.houses !== null) {
    return { ok: false, error: 'parcel_not_empty' };
  }
  const zone = catalog.slot(slot).zone;
  const { allowed, cost, hours } =
    target.kind === 'building'
      ? {
          allowed: catalog.building(target.building).zones.includes(zone),
          cost: catalog.building(target.building).cost.deben,
          hours: catalog.building(target.building).buildHours,
        }
      : {
          allowed: data.parameters.houseZones.includes(zone),
          cost: data.parameters.houseBlockCost.deben,
          hours: data.parameters.houseBlockBuildHours,
        };
  if (!allowed) {
    return { ok: false, error: 'zone_not_allowed' };
  }
  if (state.deben < cost) {
    return { ok: false, error: 'not_enough_deben' };
  }
  const built: ParcelState =
    target.kind === 'building'
      ? {
          ...parcel,
          building: target.building,
          workers: 0,
          buildEndsAt: now + hours,
        }
      : {
          ...parcel,
          houses: { level: 1, count: data.parameters.housesPerBlock },
          buildEndsAt: now + hours,
        };
  return {
    ok: true,
    state: replaceParcel({ ...state, deben: state.deben - cost }, index, built),
  };
}

/** Sets the workers assigned to a building, from 0 to the number it requires. */
export function assignWorkers(
  state: NomeState,
  data: GameData,
  slot: number,
  workers: number,
): ActionResult {
  const index = state.parcels.findIndex((p) => p.slot === slot);
  if (index < 0) {
    return { ok: false, error: 'unknown_parcel' };
  }
  const parcel = state.parcels[index];
  if (parcel.building === null) {
    return { ok: false, error: 'no_building' };
  }
  const required = catalogOf(data).building(parcel.building).workers;
  if (!Number.isInteger(workers) || workers < 0 || workers > required) {
    return { ok: false, error: 'invalid_workers' };
  }
  return {
    ok: true,
    state: replaceParcel(state, index, { ...parcel, workers }),
  };
}

/**
 * Swaps the crop of a field for another field allowed on its zone. Only
 * during Akhet: the choice is locked when Peret starts.
 */
export function chooseCrop(
  state: NomeState,
  data: GameData,
  slot: number,
  crop: BuildingId,
  now: number,
): ActionResult {
  const catalog = catalogOf(data);
  const index = state.parcels.findIndex((p) => p.slot === slot);
  if (index < 0) {
    return { ok: false, error: 'unknown_parcel' };
  }
  const parcel = state.parcels[index];
  const target = catalog.building(crop);
  if (
    parcel.building === null ||
    parcel.buildEndsAt !== null ||
    catalog.building(parcel.building).kind !== 'field' ||
    target.kind !== 'field'
  ) {
    return { ok: false, error: 'not_a_field' };
  }
  if (!target.zones.includes(catalog.slot(slot).zone)) {
    return { ok: false, error: 'zone_not_allowed' };
  }
  const { hourOfYear } = phaseAt(now, data.parameters.yearHours);
  if (hourOfYear >= NILE_CALENDAR.akhetEndsAt) {
    return { ok: false, error: 'crops_locked' };
  }
  return {
    ok: true,
    state: replaceParcel(state, index, {
      ...parcel,
      building: crop,
      workers: Math.min(parcel.workers, target.workers),
    }),
  };
}

/** The offering of the day to a god: its cost against its favour. */
export function makeOffering(
  state: NomeState,
  data: GameData,
  god: God,
  now: number,
): ActionResult {
  const params = data.parameters;
  const last = state.rules.lastOfferingAt;
  if (last !== null && now - last < params.offeringIntervalHours) {
    return { ok: false, error: 'offering_too_soon' };
  }
  const def = data.gods.find((g) => g.id === god);
  if (!def) {
    throw new Error(`unknown god ${god}`);
  }
  const { resource, quantity } = def.offering;
  const stock = state.stocks[resource] ?? 0;
  if (stock < quantity) {
    return { ok: false, error: 'not_enough_resources' };
  }
  return {
    ok: true,
    state: {
      ...state,
      stocks: { ...state.stocks, [resource]: stock - quantity },
      rules: {
        ...state.rules,
        lastOfferingAt: now,
        gods: {
          ...state.rules.gods,
          [god]: Math.min(
            params.godFavorMax,
            state.rules.gods[god] + def.favorPerOffering,
          ),
        },
      },
    },
  };
}

/** The player's choice on a pending event card. */
export function chooseCard(
  state: NomeState,
  context: RulesContext,
  drawId: number,
  choice: CardChoiceKey,
  now: number,
): ActionResult {
  const next = JSON.parse(JSON.stringify(state)) as NomeState;
  const error = applyChoice(
    next,
    drawId,
    choice,
    now,
    context,
    catalogOf(context.data),
    true,
  );
  return error === null ? { ok: true, state: next } : { ok: false, error };
}

function replaceParcel(
  state: NomeState,
  index: number,
  parcel: ParcelState,
): NomeState {
  const parcels = [...state.parcels];
  parcels[index] = parcel;
  return { ...state, parcels };
}
