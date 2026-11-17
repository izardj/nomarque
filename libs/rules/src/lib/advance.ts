// Production computed on demand. advance(state, from, to) replays the nome
// between two game-hour instants and is exact for any cut of the interval:
// advance(a→c) equals advance(b→c) after advance(a→b), up to rounding.
//
// Two kinds of instants split the interval:
// - discrete events, at fixed instants of the game: construction ends, the
//   6-hour grid (house levels), harvest, tribute, phase and year starts;
// - stock events between them: a stock reaching zero or its capacity changes
//   the flows, so the interval is cut there too.
// Between two such instants every rate is constant and integrates exactly.

import type { Service, ResourceId } from '@nomarque/data';
import {
  HOUSE_RULES,
  NILE_CALENDAR,
  SEGMENT_HOURS,
  isGridPoint,
  nextGridPoint,
  nextHourOfYear,
  phaseAt,
} from './calendar';
import { catalogOf, parcelDistance, type Catalog } from './catalog';
import {
  STOCK_EPSILON,
  flows,
  storageCapacity,
  workforce,
  type Workforce,
} from './economy';
import { addAmount, emptyReport, type AdvanceReport } from './report';
import {
  isComplete,
  type CellAccumulator,
  type HouseLevel,
  type NomeState,
  type RulesContext,
} from './state';

/** A need counts as met when this share of its demand was consumed. */
const COVERAGE_TOLERANCE = 1e-6;
/** Guards against a runaway loop of stock events within one interval. */
const MAX_STOCK_EVENTS = 10_000;

export interface AdvanceResult {
  state: NomeState;
  report: AdvanceReport;
}

/**
 * The nome at game hour `to`, from its state at game hour `from`. Events at
 * an instant t are applied when from < t <= to. The input is not modified.
 */
export function advance(
  state: NomeState,
  from: number,
  to: number,
  context: RulesContext,
): AdvanceResult {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    throw new RangeError(`invalid interval ${from} → ${to}`);
  }
  const catalog = catalogOf(context.data);
  const next = cloneState(state);
  const report = emptyReport(from, to);
  let t = from;
  while (t < to) {
    const event = nextEventAfter(next, t, catalog);
    const stop = Math.min(event, to);
    integrate(next, t, stop, catalog, report);
    t = stop;
    if (stop === event) {
      applyEvents(next, t, context, catalog, report);
    }
  }
  return { state: next, report };
}

function nextEventAfter(state: NomeState, t: number, catalog: Catalog): number {
  const yearHours = catalog.data.parameters.yearHours;
  let next = Math.min(
    nextGridPoint(t),
    nextHourOfYear(t, 0, yearHours),
    nextHourOfYear(t, NILE_CALENDAR.akhetEndsAt, yearHours),
    nextHourOfYear(t, NILE_CALENDAR.harvestAt, yearHours),
    nextHourOfYear(t, NILE_CALENDAR.tributeAt, yearHours),
  );
  for (const parcel of state.parcels) {
    if (parcel.buildEndsAt !== null && parcel.buildEndsAt > t) {
      next = Math.min(next, parcel.buildEndsAt);
    }
  }
  return next;
}

/** Continuous production over [t0, t1], with no discrete event inside. */
function integrate(
  state: NomeState,
  t0: number,
  t1: number,
  catalog: Catalog,
  report: AdvanceReport,
): void {
  const yearHours = catalog.data.parameters.yearHours;
  const phase = phaseAt((t0 + t1) / 2, yearHours).phase;
  const work = workforce(state, catalog, phase);
  const capacity = storageCapacity(state, catalog, work);
  let t = t0;
  for (let i = 0; t < t1; i++) {
    if (i >= MAX_STOCK_EVENTS) {
      throw new Error(`too many stock events between ${t0} and ${t1}`);
    }
    const f = flows(state, catalog, work, capacity);
    let step = t1 - t;
    for (const resource of catalog.resourceOrder) {
      const rate = f.net[resource] ?? 0;
      const stock = state.stocks[resource] ?? 0;
      if (rate < 0 && stock > STOCK_EPSILON) {
        step = Math.min(step, stock / -rate);
      } else if (rate > 0 && stock < capacity - STOCK_EPSILON) {
        step = Math.min(step, (capacity - stock) / rate);
      }
    }

    for (const resource of catalog.resourceOrder) {
      const rate = f.net[resource] ?? 0;
      if (rate === 0) {
        continue;
      }
      let stock = (state.stocks[resource] ?? 0) + rate * step;
      if (rate < 0 && stock <= STOCK_EPSILON) {
        stock = 0;
      } else if (rate > 0 && stock >= capacity - STOCK_EPSILON) {
        stock = capacity;
      }
      state.stocks[resource] = stock;
    }
    scaleInto(report.produced, f.produced, step);
    scaleInto(report.consumed, f.consumed, step);
    scaleInto(report.lost, f.lost, step);
    scaleInto(report.shortages, f.shortages, step);
    state.deben += f.taxPerHour * step;
    report.taxes += f.taxPerHour * step;

    for (const [slot, flow] of f.consumers) {
      const cell = state.rules.cells[slot];
      if (cell) {
        scaleInto(cell.demand, flow.demand, step);
        scaleInto(cell.consumed, flow.consumed, step);
      }
    }
    if (phase === 'peret') {
      accumulatePeret(state, catalog, work, step);
    }
    t = step >= t1 - t ? t1 : t + step;
  }
}

function accumulatePeret(
  state: NomeState,
  catalog: Catalog,
  work: Workforce,
  hours: number,
): void {
  for (const parcel of state.parcels) {
    if (parcel.building && catalog.building(parcel.building).kind === 'field') {
      const s = work.occupancy.get(parcel.slot) ?? 0;
      if (s > 0) {
        state.rules.peretOccupancy[parcel.slot] =
          (state.rules.peretOccupancy[parcel.slot] ?? 0) + s * hours;
      }
    }
  }
}

function applyEvents(
  state: NomeState,
  t: number,
  context: RulesContext,
  catalog: Catalog,
  report: AdvanceReport,
): void {
  const yearHours = catalog.data.parameters.yearHours;
  const { year, hourOfYear, phase } = phaseAt(t, yearHours);

  for (const parcel of state.parcels) {
    if (parcel.buildEndsAt !== null && parcel.buildEndsAt <= t) {
      parcel.buildEndsAt = null;
      report.completed.push(parcel.slot);
    }
  }
  if (hourOfYear === NILE_CALENDAR.harvestAt) {
    harvest(state, year, context, catalog, report);
  }
  if (hourOfYear === NILE_CALENDAR.tributeAt) {
    levyTribute(state, catalog, report);
  }
  if (isGridPoint(t)) {
    evaluateHouses(state, t, catalog, report);
  }
  if (hourOfYear === 0) {
    state.rules.harvested = {};
  }

  const capacity = storageCapacity(
    state,
    catalog,
    workforce(state, catalog, phase),
  );
  for (const resource of catalog.resourceOrder) {
    const stock = state.stocks[resource] ?? 0;
    if (stock > capacity) {
      addAmount(report.lost, resource, stock - capacity);
      state.stocks[resource] = capacity;
    }
  }
}

/** Fields yield their yearly output × mean Peret occupancy × flood multiplier. */
function harvest(
  state: NomeState,
  year: number,
  context: RulesContext,
  catalog: Catalog,
  report: AdvanceReport,
): void {
  const flood = context.floods[year];
  if (flood === undefined) {
    throw new RangeError(`no flood level for year ${year}`);
  }
  const multiplier = catalog.data.parameters.floodMultiplier[flood];
  const peretHours = NILE_CALENDAR.peretEndsAt - NILE_CALENDAR.akhetEndsAt;
  for (const parcel of state.parcels) {
    if (!parcel.building || !isComplete(parcel)) {
      continue;
    }
    const def = catalog.building(parcel.building);
    if (def.kind !== 'field') {
      continue;
    }
    const meanOccupancy =
      (state.rules.peretOccupancy[parcel.slot] ?? 0) / peretHours;
    for (const out of def.outputs) {
      const amount = out.perYear * meanOccupancy * multiplier;
      addAmount(state.stocks, out.resource, amount);
      addAmount(state.rules.harvested, out.resource, amount);
      addAmount(report.harvested, out.resource, amount);
    }
  }
  state.rules.peretOccupancy = {};
}

function levyTribute(
  state: NomeState,
  catalog: Catalog,
  report: AdvanceReport,
): void {
  const rate = catalog.data.parameters.tributeRate;
  for (const resource of catalog.data.resources) {
    if (!resource.cereal) {
      continue;
    }
    const due = (state.rules.harvested[resource.id] ?? 0) * rate;
    const paid = Math.min(due, state.stocks[resource.id] ?? 0);
    addAmount(state.stocks, resource.id, -paid);
    addAmount(report.tribute, resource.id, paid);
    if (due - paid > STOCK_EPSILON) {
      addAmount(report.tributeMissing, resource.id, due - paid);
    }
  }
}

interface ActiveService {
  slot: number;
  service: Service;
  range: number;
}

/**
 * Judges every block of houses on the cell that just ended, then opens a new
 * cell for every consumer that will be present for all of it.
 */
function evaluateHouses(
  state: NomeState,
  t: number,
  catalog: Catalog,
  report: AdvanceReport,
): void {
  const phase = phaseAt(t, catalog.data.parameters.yearHours).phase;
  const work = workforce(state, catalog, phase);
  const services = activeServices(state, catalog, work);

  for (const parcel of state.parcels) {
    const cell = state.rules.cells[parcel.slot];
    if (!parcel.houses || !isComplete(parcel) || !cell) {
      continue;
    }
    const track = state.rules.houses[parcel.slot] ?? {
      upHours: 0,
      missingHours: 0,
    };
    const level = parcel.houses.level;
    const house = catalog.house(level);
    const met =
      isCovered(cell) &&
      servicesMet(house.services, parcel.slot, services, catalog);
    if (met) {
      track.missingHours = 0;
      const next = catalog.nextHouse(level);
      const reachable =
        next !== null &&
        servicesMet(next.services, parcel.slot, services, catalog) &&
        next.needs.every(
          (need) => (state.stocks[need.resource] ?? 0) > STOCK_EPSILON,
        );
      track.upHours = reachable ? track.upHours + SEGMENT_HOURS : 0;
      if (next && track.upHours >= HOUSE_RULES.upgradeAfterHours) {
        parcel.houses.level = next.level;
        report.houseChanges.push({
          slot: parcel.slot,
          at: t,
          from: level,
          to: next.level,
        });
        track.upHours = 0;
      }
    } else {
      track.upHours = 0;
      const before = track.missingHours;
      track.missingHours += SEGMENT_HOURS;
      if (
        before < HOUSE_RULES.warnAfterHours &&
        track.missingHours >= HOUSE_RULES.warnAfterHours
      ) {
        report.houseWarnings.push({ slot: parcel.slot, at: t });
      }
      if (track.missingHours >= HOUSE_RULES.downgradeAfterHours && level > 1) {
        const lower = (level - 1) as HouseLevel;
        parcel.houses.level = lower;
        report.houseChanges.push({
          slot: parcel.slot,
          at: t,
          from: level,
          to: lower,
        });
        track.missingHours = 0;
      }
    }
    state.rules.houses[parcel.slot] = track;
  }

  const cells: Record<number, CellAccumulator> = {};
  for (const parcel of state.parcels) {
    if (!isComplete(parcel)) {
      continue;
    }
    const hasUpkeep =
      parcel.building !== null &&
      catalog.building(parcel.building).service !== null &&
      catalog.building(parcel.building).inputs.length > 0;
    if (parcel.houses || hasUpkeep) {
      cells[parcel.slot] = { demand: {}, consumed: {} };
    }
  }
  state.rules.cells = cells;
}

/** Staffed services whose upkeep, if any, was fully covered over the cell. */
function activeServices(
  state: NomeState,
  catalog: Catalog,
  work: Workforce,
): ActiveService[] {
  const active: ActiveService[] = [];
  for (const parcel of state.parcels) {
    if (!parcel.building || !isComplete(parcel)) {
      continue;
    }
    const def = catalog.building(parcel.building);
    if (def.service === null || def.range === null) {
      continue;
    }
    if ((work.occupancy.get(parcel.slot) ?? 0) <= 0) {
      continue;
    }
    if (def.inputs.length > 0) {
      const cell = state.rules.cells[parcel.slot];
      if (!cell || !isCovered(cell)) {
        continue;
      }
    }
    active.push({ slot: parcel.slot, service: def.service, range: def.range });
  }
  return active;
}

/** Each required service counts once: a villa needing two temples lists it twice. */
function servicesMet(
  required: readonly Service[],
  slot: number,
  active: readonly ActiveService[],
  catalog: Catalog,
): boolean {
  const here = catalog.slot(slot);
  const needed = new Map<Service, number>();
  for (const service of required) {
    needed.set(service, (needed.get(service) ?? 0) + 1);
  }
  for (const [service, count] of needed) {
    const inRange = active.filter(
      (a) =>
        a.service === service &&
        parcelDistance(here, catalog.slot(a.slot)) <= a.range,
    ).length;
    if (inRange < count) {
      return false;
    }
  }
  return true;
}

function isCovered(cell: CellAccumulator): boolean {
  for (const [resource, demand] of Object.entries(cell.demand) as [
    ResourceId,
    number,
  ][]) {
    if ((cell.consumed[resource] ?? 0) < demand * (1 - COVERAGE_TOLERANCE)) {
      return false;
    }
  }
  return true;
}

function scaleInto(
  target: Partial<Record<ResourceId, number>>,
  rates: Partial<Record<ResourceId, number>>,
  hours: number,
): void {
  for (const [resource, rate] of Object.entries(rates) as [
    ResourceId,
    number,
  ][]) {
    addAmount(target, resource, rate * hours);
  }
}

function cloneState(state: NomeState): NomeState {
  return JSON.parse(JSON.stringify(state)) as NomeState;
}
