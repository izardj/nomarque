import type {
  BuildingDef,
  BuildingId,
  GameData,
  HouseDef,
  MapSlotDef,
  ResourceId,
} from '@nomarque/data';
import type { HouseLevel } from './state';

/** Lookups over the game data, built once per data object. */
export interface Catalog {
  data: GameData;
  building(id: BuildingId): BuildingDef;
  house(level: HouseLevel): HouseDef;
  /** Next level a house may reach in the MVP, or null. */
  nextHouse(level: HouseLevel): HouseDef | null;
  slot(slot: number): MapSlotDef;
  /**
   * Resources ordered so that every workshop input comes before its output:
   * raw goods first, then each transformation step.
   */
  resourceOrder: readonly ResourceId[];
}

const catalogs = new WeakMap<GameData, Catalog>();

export function catalogOf(data: GameData): Catalog {
  const cached = catalogs.get(data);
  if (cached) {
    return cached;
  }
  const catalog = buildCatalog(data);
  catalogs.set(data, catalog);
  return catalog;
}

function buildCatalog(data: GameData): Catalog {
  const buildings = new Map(data.buildings.map((b) => [b.id, b]));
  const houses = new Map(data.houses.map((h) => [h.level, h]));
  const slots = new Map(data.map.map((s) => [s.slot, s]));
  return {
    data,
    building(id) {
      return required(buildings.get(id), `unknown building ${id}`);
    },
    house(level) {
      return required(houses.get(level), `unknown house level ${level}`);
    },
    nextHouse(level) {
      const next =
        level < 4 ? houses.get((level + 1) as HouseLevel) : undefined;
      return next && next.inMvp ? next : null;
    },
    slot(slot) {
      return required(slots.get(slot), `unknown slot ${slot}`);
    },
    resourceOrder: orderResources(data),
  };
}

function orderResources(data: GameData): ResourceId[] {
  const depth = new Map<ResourceId, number>();
  const visiting = new Set<ResourceId>();
  const depthOf = (resource: ResourceId): number => {
    const known = depth.get(resource);
    if (known !== undefined) {
      return known;
    }
    if (visiting.has(resource)) {
      throw new Error(`production cycle through ${resource}`);
    }
    visiting.add(resource);
    let value = 0;
    for (const building of data.buildings) {
      if (!building.outputs.some((o) => o.resource === resource)) {
        continue;
      }
      for (const input of building.inputs) {
        value = Math.max(value, depthOf(input.resource) + 1);
      }
    }
    visiting.delete(resource);
    depth.set(resource, value);
    return value;
  };
  const ids = data.resources.map((r) => r.id);
  return [...ids].sort((a, b) => depthOf(a) - depthOf(b));
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

/** Chebyshev distance between two parcels of the map. */
export function parcelDistance(a: MapSlotDef, b: MapSlotDef): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}
