import type {
  BuildingId,
  FloodLevel,
  GameData,
  ResourceId,
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
}

export interface NomeState {
  deben: number;
  stocks: ResourceAmounts;
  /** Ordered by slot, one entry per slot of the map. */
  parcels: ParcelState[];
  rules: RulesState;
}

export interface RulesContext {
  data: GameData;
  /** Flood level of each Nile year of the reign, by zero-based year. */
  floods: readonly FloodLevel[];
}

export function emptyRulesState(): RulesState {
  return { houses: {}, cells: {}, peretOccupancy: {}, harvested: {} };
}

export function isComplete(parcel: ParcelState): boolean {
  return parcel.buildEndsAt === null;
}
