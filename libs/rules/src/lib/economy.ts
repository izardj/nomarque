// Instantaneous economy of a nome: workforce, occupancy and resource flows.
// Every rate here is per game hour and constant until the next discrete event
// (construction end, grid point, phase change) or until a stock reaches zero
// or its capacity.

import {
  WORKER_CLASSES,
  type ResourceId,
  type WorkerClass,
} from '@nomarque/data';
import type { Catalog } from './catalog';
import { phaseAt, type NilePhase } from './calendar';
import {
  activeModifiers,
  adjustAvailable,
  consumptionFactor,
  idleFactor,
  productionFactor,
} from './modifiers';
import { addAmount } from './report';
import {
  isComplete,
  type NomeState,
  type ParcelState,
  type ResourceAmounts,
} from './state';

/** Below this, a stock counts as empty. */
export const STOCK_EPSILON = 1e-9;

export interface ClassWorkforce {
  /** Working inhabitants of the class. */
  available: number;
  /** Workers assigned to complete, working buildings of the class. */
  assigned: number;
  /** Share of each assignment actually filled, in [0, 1]. */
  ratio: number;
}

export interface Workforce {
  classes: Record<WorkerClass, ClassWorkforce>;
  /** Occupancy s of each complete building, by slot: effective / required. */
  occupancy: Map<number, number>;
  /** Game instant the workforce is computed at. */
  at: number;
}

/**
 * Available workers per class come from the houses, then card effects; when
 * assignments of a class exceed its supply, every assignment of the class is
 * cut by the same ratio. During Akhet the fields are flooded and need nobody.
 * Idle effects then slow some buildings down without freeing their workers.
 */
export function workforce(
  state: NomeState,
  catalog: Catalog,
  at: number,
): Workforce {
  const phase = phaseAt(at, catalog.data.parameters.yearHours).phase;
  const active = activeModifiers(state, at);
  const inhabitants = Object.fromEntries(
    WORKER_CLASSES.map((c) => [c, 0]),
  ) as Record<WorkerClass, number>;
  const assigned = Object.fromEntries(
    WORKER_CLASSES.map((c) => [c, 0]),
  ) as Record<WorkerClass, number>;

  for (const parcel of state.parcels) {
    if (!isComplete(parcel)) {
      continue;
    }
    if (parcel.houses) {
      const house = catalog.house(parcel.houses.level);
      inhabitants[house.workerClass] += house.inhabitants * parcel.houses.count;
    }
    if (parcel.building && isWorking(parcel, catalog, phase)) {
      assigned[catalog.building(parcel.building).workerClass] += parcel.workers;
    }
  }

  const activityRate = catalog.data.parameters.activityRate;
  const classes = Object.fromEntries(
    WORKER_CLASSES.map((c) => {
      const available = adjustAvailable(
        Math.floor(inhabitants[c] * activityRate) + state.rules.population[c],
        c,
        active,
      );
      const ratio = assigned[c] > 0 ? Math.min(1, available / assigned[c]) : 1;
      return [c, { available, assigned: assigned[c], ratio }];
    }),
  ) as Record<WorkerClass, ClassWorkforce>;

  const occupancy = new Map<number, number>();
  for (const parcel of state.parcels) {
    if (!parcel.building || !isComplete(parcel)) {
      continue;
    }
    const def = catalog.building(parcel.building);
    const working = isWorking(parcel, catalog, phase);
    const effective = working
      ? parcel.workers * classes[def.workerClass].ratio
      : 0;
    const staffed = def.workers > 0 ? Math.min(1, effective / def.workers) : 1;
    occupancy.set(parcel.slot, staffed * idleFactor(parcel, catalog, active));
  }
  return { classes, occupancy, at };
}

function isWorking(
  parcel: ParcelState,
  catalog: Catalog,
  phase: NilePhase,
): boolean {
  if (!parcel.building) {
    return false;
  }
  return !(
    phase === 'akhet' && catalog.building(parcel.building).kind === 'field'
  );
}

/** Storage capacity per resource, raised by staffed granaries. */
export function storageCapacity(
  state: NomeState,
  catalog: Catalog,
  work: Workforce,
): number {
  const { baseStorage, granaryCapacity } = catalog.data.parameters;
  let capacity = baseStorage;
  for (const parcel of state.parcels) {
    if (
      parcel.building &&
      catalog.building(parcel.building).kind === 'storage'
    ) {
      capacity += granaryCapacity * (work.occupancy.get(parcel.slot) ?? 0);
    }
  }
  return capacity;
}

export interface ConsumerFlow {
  demand: ResourceAmounts;
  consumed: ResourceAmounts;
}

export interface Flows {
  produced: ResourceAmounts;
  consumed: ResourceAmounts;
  /** Stock change per hour, after storage losses. */
  net: ResourceAmounts;
  lost: ResourceAmounts;
  /** Unmet house needs. */
  shortages: ResourceAmounts;
  /** Houses and services with upkeep, by slot. */
  consumers: Map<number, ConsumerFlow>;
  taxPerHour: number;
}

interface Consumer {
  slot: number;
  /** Demand per hour, by resource. */
  demand: ResourceAmounts;
  /** A workshop or service stops as a whole when one input runs short. */
  allOrNothing: boolean;
  /** Output per hour at full supply, for workshops. */
  output: ResourceAmounts;
  isHouse: boolean;
}

/**
 * Resource flows per hour for the current stocks. A non-empty stock serves
 * every demand in full. An empty stock shares its inflow among its consumers
 * in proportion to their demand, so the result does not depend on how an
 * interval is cut.
 */
export function flows(
  state: NomeState,
  catalog: Catalog,
  work: Workforce,
  capacity: number,
): Flows {
  const yearHours = catalog.data.parameters.yearHours;
  const active = activeModifiers(state, work.at);
  const produced: ResourceAmounts = {};
  const consumers: Consumer[] = [];
  let taxPerHour = 0;

  for (const parcel of state.parcels) {
    if (!isComplete(parcel)) {
      continue;
    }
    if (parcel.houses) {
      const house = catalog.house(parcel.houses.level);
      const people = house.inhabitants * parcel.houses.count;
      taxPerHour += (house.taxPerInhabitantPerYear * people) / yearHours;
      const demand: ResourceAmounts = {};
      for (const need of house.needs) {
        addAmount(
          demand,
          need.resource,
          ((need.perInhabitantPerYear * people) / yearHours) *
            consumptionFactor(need.resource, active),
        );
      }
      consumers.push({
        slot: parcel.slot,
        demand,
        allOrNothing: false,
        output: {},
        isHouse: true,
      });
      continue;
    }
    if (!parcel.building) {
      continue;
    }
    const def = catalog.building(parcel.building);
    const s = work.occupancy.get(parcel.slot) ?? 0;
    if (def.kind === 'field' || s === 0) {
      continue;
    }
    if (def.inputs.length === 0) {
      for (const out of def.outputs) {
        addAmount(
          produced,
          out.resource,
          (out.perYear / yearHours) *
            s *
            productionFactor(out.resource, active),
        );
      }
      continue;
    }
    const demand: ResourceAmounts = {};
    for (const input of def.inputs) {
      addAmount(demand, input.resource, (input.perYear / yearHours) * s);
    }
    const output: ResourceAmounts = {};
    for (const out of def.outputs) {
      addAmount(
        output,
        out.resource,
        (out.perYear / yearHours) * s * productionFactor(out.resource, active),
      );
    }
    consumers.push({
      slot: parcel.slot,
      demand,
      allOrNothing: true,
      output,
      isHouse: false,
    });
  }

  // Walk resources from raw to most transformed. When a resource is reached,
  // every producer of it already knows its own supply ratio.
  const share = new Map<ResourceId, number>();
  const supplied = new Map<Consumer, number>();
  const supplyOf = (consumer: Consumer): number => {
    const known = supplied.get(consumer);
    if (known !== undefined) {
      return known;
    }
    let k = 1;
    for (const resource of Object.keys(consumer.demand) as ResourceId[]) {
      k = Math.min(k, share.get(resource) ?? 1);
    }
    supplied.set(consumer, k);
    return k;
  };

  for (const resource of catalog.resourceOrder) {
    for (const consumer of consumers) {
      const out = consumer.output[resource];
      if (out !== undefined) {
        addAmount(produced, resource, out * supplyOf(consumer));
      }
    }
    let demand = 0;
    for (const consumer of consumers) {
      demand += consumer.demand[resource] ?? 0;
    }
    const stock = state.stocks[resource] ?? 0;
    const inflow = produced[resource] ?? 0;
    share.set(
      resource,
      stock > STOCK_EPSILON || demand <= inflow ? 1 : inflow / demand,
    );
  }

  const consumed: ResourceAmounts = {};
  const shortages: ResourceAmounts = {};
  const consumerFlows = new Map<number, ConsumerFlow>();
  for (const consumer of consumers) {
    const k = consumer.allOrNothing ? supplyOf(consumer) : 1;
    const flow: ConsumerFlow = { demand: consumer.demand, consumed: {} };
    for (const [resource, demand] of Object.entries(consumer.demand) as [
      ResourceId,
      number,
    ][]) {
      const taken =
        demand * (consumer.allOrNothing ? k : (share.get(resource) ?? 1));
      addAmount(flow.consumed, resource, taken);
      addAmount(consumed, resource, taken);
      if (consumer.isHouse && demand - taken > STOCK_EPSILON * demand) {
        addAmount(shortages, resource, demand - taken);
      }
    }
    consumerFlows.set(consumer.slot, flow);
  }

  const net: ResourceAmounts = {};
  const lost: ResourceAmounts = {};
  for (const resource of catalog.resourceOrder) {
    const stock = state.stocks[resource] ?? 0;
    let delta = (produced[resource] ?? 0) - (consumed[resource] ?? 0);
    if (stock <= STOCK_EPSILON && delta < 0) {
      // Rounding residue of an exactly shared inflow.
      delta = 0;
    }
    if (stock >= capacity - STOCK_EPSILON && delta > 0) {
      addAmount(lost, resource, delta);
      delta = 0;
    }
    addAmount(net, resource, delta);
  }

  return {
    produced,
    consumed,
    net,
    lost,
    shortages,
    consumers: consumerFlows,
    taxPerHour,
  };
}
