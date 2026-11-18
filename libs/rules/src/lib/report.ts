import type { CardChoiceKey, ResourceId } from '@nomarque/data';
import type { HouseLevel, ResourceAmounts } from './state';

export interface HouseLevelChange {
  slot: number;
  at: number;
  from: HouseLevel;
  to: HouseLevel;
}

export interface HouseWarning {
  slot: number;
  at: number;
}

export interface CardDealt {
  drawId: number;
  cardId: string;
  at: number;
}

export interface CardDefaulted extends CardDealt {
  choice: CardChoiceKey;
}

/** What happened over an interval, for the steward's report. */
export interface AdvanceReport {
  from: number;
  to: number;
  /** Continuous production of raw buildings and workshops. */
  produced: ResourceAmounts;
  /** Consumed by workshops, services and houses. */
  consumed: ResourceAmounts;
  /** Lost to full storage. */
  lost: ResourceAmounts;
  harvested: ResourceAmounts;
  tribute: ResourceAmounts;
  /** Tribute owed but not in stock. */
  tributeMissing: ResourceAmounts;
  /** House needs left unmet. */
  shortages: ResourceAmounts;
  taxes: number;
  /** Slots whose construction ended. */
  completed: number[];
  houseChanges: HouseLevelChange[];
  houseWarnings: HouseWarning[];
  /** Change of the pharaoh's favour from the tribute. */
  royalFavor: number;
  cardsDealt: CardDealt[];
  /** Cards whose grace period ended: their default choice applied. */
  cardsDefaulted: CardDefaulted[];
}

export function emptyReport(from: number, to: number): AdvanceReport {
  return {
    from,
    to,
    produced: {},
    consumed: {},
    lost: {},
    harvested: {},
    tribute: {},
    tributeMissing: {},
    shortages: {},
    taxes: 0,
    completed: [],
    houseChanges: [],
    houseWarnings: [],
    royalFavor: 0,
    cardsDealt: [],
    cardsDefaulted: [],
  };
}

/** Report of two consecutive intervals, `first` ending where `second` starts. */
export function mergeReports(
  first: AdvanceReport,
  second: AdvanceReport,
): AdvanceReport {
  return {
    from: first.from,
    to: second.to,
    produced: sumAmounts(first.produced, second.produced),
    consumed: sumAmounts(first.consumed, second.consumed),
    lost: sumAmounts(first.lost, second.lost),
    harvested: sumAmounts(first.harvested, second.harvested),
    tribute: sumAmounts(first.tribute, second.tribute),
    tributeMissing: sumAmounts(first.tributeMissing, second.tributeMissing),
    shortages: sumAmounts(first.shortages, second.shortages),
    taxes: first.taxes + second.taxes,
    completed: [...first.completed, ...second.completed],
    houseChanges: [...first.houseChanges, ...second.houseChanges],
    houseWarnings: [...first.houseWarnings, ...second.houseWarnings],
    royalFavor: first.royalFavor + second.royalFavor,
    cardsDealt: [...first.cardsDealt, ...second.cardsDealt],
    cardsDefaulted: [...first.cardsDefaulted, ...second.cardsDefaulted],
  };
}

export function addAmount(
  amounts: ResourceAmounts,
  resource: ResourceId,
  quantity: number,
): void {
  if (quantity === 0) {
    return;
  }
  amounts[resource] = (amounts[resource] ?? 0) + quantity;
}

function sumAmounts(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
  const sum: ResourceAmounts = { ...a };
  for (const [resource, quantity] of Object.entries(b) as [
    ResourceId,
    number,
  ][]) {
    addAmount(sum, resource, quantity);
  }
  return sum;
}
