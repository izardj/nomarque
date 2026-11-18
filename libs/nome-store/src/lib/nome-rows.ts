import type { BuildingId, ResourceId, Zone } from '@nomarque/data';
import { GAME_DATA } from '@nomarque/data';
import type { Parcel, Prisma, Zone as DbZone } from '@nomarque/db';
import { catalogOf, type HouseLevel, type ParcelState } from '@nomarque/rules';

const ZONE_TO_DB: Record<Zone, DbZone> = {
  desert: 'DESERT',
  city: 'CITY',
  black_land: 'BLACK_LAND',
  river: 'RIVER',
};

/** Columns of a parcel that change after the nome is founded. */
export type ParcelColumns = Pick<
  Parcel,
  'buildingType' | 'houseLevel' | 'houseCount' | 'workers' | 'buildEndsAt'
>;

/** Rules state and reports are plain JSON documents owned by libs/rules. */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function parcelColumns(parcel: ParcelState): ParcelColumns {
  return {
    buildingType: parcel.building,
    houseLevel: parcel.houses?.level ?? null,
    houseCount: parcel.houses?.count ?? 0,
    workers: parcel.workers,
    buildEndsAt: parcel.buildEndsAt,
  };
}

/** A new parcel row; its zone is copied from the map of the game data. */
export function parcelToRow(
  nomeId: string,
  parcel: ParcelState,
): Omit<Parcel, 'id'> {
  return {
    nomeId,
    slot: parcel.slot,
    zone: ZONE_TO_DB[catalogOf(GAME_DATA).slot(parcel.slot).zone],
    ...parcelColumns(parcel),
  };
}

export function rowToParcel(row: Parcel): ParcelState {
  return {
    slot: row.slot,
    // The column only ever holds ids written from a BuildingId.
    building: row.buildingType as BuildingId | null,
    houses:
      row.houseLevel === null
        ? null
        : { level: row.houseLevel as HouseLevel, count: row.houseCount },
    workers: row.workers,
    buildEndsAt: row.buildEndsAt,
  };
}

/** Resource ids of the stock rows are written from the state, so they are valid. */
export function isResourceId(value: string): value is ResourceId {
  return GAME_DATA.resources.some((resource) => resource.id === value);
}
