// What each building yields at the current assignment, for the Workers screen.
// Same formulas as advance, read at one instant.

import type { FloodLevel, GameData, ResourceId } from '@nomarque/data';
import { NILE_CALENDAR, phaseAt } from './calendar';
import { catalogOf } from './catalog';
import { flows, storageCapacity, workforce, type Workforce } from './economy';
import { addAmount } from './report';
import type { NomeState, ResourceAmounts } from './state';

export interface ParcelForecast {
  slot: number;
  /** Effective workers / required workers, in [0, 1]. */
  occupancy: number;
  /** Continuous output per Nile year at the current rates. */
  perYear: ResourceAmounts;
  /**
   * Fields only: the coming harvest if the current occupancy holds until the
   * end of Peret, with this year's flood.
   */
  harvest: ResourceAmounts | null;
}

export interface NomeForecast {
  workforce: Workforce['classes'];
  capacity: number;
  parcels: ParcelForecast[];
}

export function forecast(
  state: NomeState,
  data: GameData,
  at: number,
  flood: FloodLevel,
): NomeForecast {
  const catalog = catalogOf(data);
  const { yearHours, floodMultiplier } = data.parameters;
  const { phase, hourOfYear } = phaseAt(at, yearHours);
  const work = workforce(state, catalog, phase);
  const capacity = storageCapacity(state, catalog, work);
  const f = flows(state, catalog, work, capacity);
  // Fields are judged on Peret: outside Akhet their occupancy is the same.
  const peretWork =
    phase === 'akhet' ? workforce(state, catalog, 'peret') : work;
  const peretHours = NILE_CALENDAR.peretEndsAt - NILE_CALENDAR.akhetEndsAt;

  const parcels: ParcelForecast[] = [];
  for (const parcel of state.parcels) {
    if (!parcel.building || parcel.buildEndsAt !== null) {
      continue;
    }
    const def = catalog.building(parcel.building);
    const occupancy = work.occupancy.get(parcel.slot) ?? 0;
    if (def.kind === 'field') {
      const s = peretWork.occupancy.get(parcel.slot) ?? 0;
      const remaining = remainingPeretHours(hourOfYear);
      const accumulated =
        hourOfYear < NILE_CALENDAR.akhetEndsAt
          ? 0
          : (state.rules.peretOccupancy[parcel.slot] ?? 0);
      const harvest: ResourceAmounts = {};
      if (hourOfYear < NILE_CALENDAR.harvestAt) {
        for (const out of def.outputs) {
          addAmount(
            harvest,
            out.resource,
            ((out.perYear * (accumulated + s * remaining)) / peretHours) *
              floodMultiplier[flood],
          );
        }
      }
      parcels.push({ slot: parcel.slot, occupancy: s, perYear: {}, harvest });
      continue;
    }
    const perYear: ResourceAmounts = {};
    const consumer = f.consumers.get(parcel.slot);
    const supply = supplyRatio(consumer?.demand, consumer?.consumed);
    if (occupancy > 0) {
      for (const out of def.outputs) {
        addAmount(perYear, out.resource, out.perYear * occupancy * supply);
      }
    }
    parcels.push({ slot: parcel.slot, occupancy, perYear, harvest: null });
  }
  return { workforce: work.classes, capacity, parcels };
}

function remainingPeretHours(hourOfYear: number): number {
  const start = Math.max(hourOfYear, NILE_CALENDAR.akhetEndsAt);
  return Math.max(0, NILE_CALENDAR.peretEndsAt - start);
}

function supplyRatio(
  demand?: ResourceAmounts,
  consumed?: ResourceAmounts,
): number {
  if (!demand || !consumed) {
    return 1;
  }
  let ratio = 1;
  for (const [resource, quantity] of Object.entries(demand) as [
    ResourceId,
    number,
  ][]) {
    if (quantity > 0) {
      ratio = Math.min(ratio, (consumed[resource] ?? 0) / quantity);
    }
  }
  return ratio;
}
