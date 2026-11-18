import {
  GODS,
  WORKER_CLASSES,
  type BuildingId,
  type CardEffect,
  type FloodLevel,
  type GameData,
  type God,
  type ResourceId,
  type WorkerClass,
} from '@nomarque/data';

export type ResourceAmounts = Partial<Record<ResourceId, number>>;

export type HouseLevel = 1 | 2 | 3 | 4;

export interface HouseBlock {
  level: HouseLevel;
  /** Houses on the parcel. */
  count: number;
}

/**
 * One parcel of the nome. It holds a building, a block of houses, or nothing.
 * Zone and position come from the map of the game data, by slot.
 */
export interface ParcelState {
  slot: number;
  building: BuildingId | null;
  houses: HouseBlock | null;
  /** Workers assigned by the player; the effective count may be prorated. */
  workers: number;
  /** Game hour at which construction ends; null once the parcel is complete. */
  buildEndsAt: number | null;
}

/** Level hysteresis of a block of houses, in game hours. */
export interface HouseTrack {
  /** Consecutive hours with every need met and the next level reachable. */
  upHours: number;
  /** Consecutive hours with at least one need missing. */
  missingHours: number;
}

/** Demand and consumption of one consumer over the current grid cell. */
export interface CellAccumulator {
  demand: ResourceAmounts;
  consumed: ResourceAmounts;
}

/** Effects of a card choice that last: they are active on [startsAt, endsAt). */
export type TimedEffect = Extract<
  CardEffect,
  { kind: 'workforce' | 'idle' | 'production' | 'consumption' | 'houseUpgrade' }
>;

export interface Modifier {
  effect: TimedEffect;
  startsAt: number;
  endsAt: number;
}

/** An event card dealt to the player, waiting for a choice. */
export interface PendingCard {
  /** Draw number, unique in the reign: the index of the draw instant. */
  drawId: number;
  cardId: string;
  drawnAt: number;
  /** The default choice applies at this instant. */
  expiresAt: number;
}

export interface CardsState {
  pending: PendingCard[];
  /** Cards dealt since the start of the Nile year: each comes once a year. */
  dealtThisYear: string[];
}

/**
 * Accumulators owned by libs/rules. Keys are parcel slots. The shape is opaque
 * to callers, who persist it as JSON.
 */
export interface RulesState {
  houses: Record<number, HouseTrack>;
  /**
   * Consumers (houses, services with upkeep) present for the whole current
   * cell. A parcel completed inside a cell has no entry until the next grid
   * point, so it is never judged on a partial cell.
   */
  cells: Record<number, CellAccumulator>;
  /** Integral of field occupancy over the current year's Peret. */
  peretOccupancy: Record<number, number>;
  /** Harvested this year, for the tribute. */
  harvested: ResourceAmounts;
  /** Favour of each god, from 0 to godFavorMax. */
  gods: Record<God, number>;
  /** Game hour of the last offering, null before the first. */
  lastOfferingAt: number | null;
  cards: CardsState;
  /** Card effects that last, ordered by start. */
  modifiers: Modifier[];
  /** Permanent change of the available workers of each class. */
  population: Record<WorkerClass, number>;
  /** Signed percent points on this year's harvest, reset at the harvest. */
  harvestPercent: number;
  /** Signed percent points on this year's tribute, reset at the tribute. */
  tributePercent: number;
  /** Hours before the next year start at which its flood is revealed. */
  floodForecastHours: number;
  /** Consecutive hours each class has had all its workers assigned. */
  busyHours: Record<WorkerClass, number>;
}

export interface NomeState {
  deben: number;
  /** The pharaoh's favour. */
  favor: number;
  stocks: ResourceAmounts;
  /** Ordered by slot, one entry per slot of the map. */
  parcels: ParcelState[];
  rules: RulesState;
}

export interface RulesContext {
  data: GameData;
  /** Flood level of each Nile year of the reign, by zero-based year. */
  floods: readonly FloodLevel[];
  /**
   * Seeds the nome's random draws (event cards, chances): the nome id. Draws
   * depend on it and on the game instant only, never on login times.
   */
  seed: string;
}

export function emptyRulesState(data: GameData): RulesState {
  return {
    houses: {},
    cells: {},
    peretOccupancy: {},
    harvested: {},
    gods: perGod(data.parameters.godFavorStart),
    lastOfferingAt: null,
    cards: { pending: [], dealtThisYear: [] },
    modifiers: [],
    population: perClass(0),
    harvestPercent: 0,
    tributePercent: 0,
    floodForecastHours: 0,
    busyHours: perClass(0),
  };
}

/**
 * Rules state read back from storage, completed with the fields added since it
 * was written (a nome saved by an older version keeps its accumulators).
 */
export function restoreRulesState(
  stored: Partial<RulesState> | null | undefined,
  data: GameData,
): RulesState {
  const empty = emptyRulesState(data);
  if (!stored) {
    return empty;
  }
  return {
    ...empty,
    ...stored,
    gods: { ...empty.gods, ...stored.gods },
    cards: { ...empty.cards, ...stored.cards },
    population: { ...empty.population, ...stored.population },
    busyHours: { ...empty.busyHours, ...stored.busyHours },
  };
}

function perGod(value: number): Record<God, number> {
  return Object.fromEntries(GODS.map((g) => [g, value])) as Record<God, number>;
}

function perClass(value: number): Record<WorkerClass, number> {
  return Object.fromEntries(WORKER_CLASSES.map((c) => [c, value])) as Record<
    WorkerClass,
    number
  >;
}

export function isComplete(parcel: ParcelState): boolean {
  return parcel.buildEndsAt === null;
}
