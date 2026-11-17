import {
  BUILDING_IDS,
  type BuildingId,
  type FloodLevel,
  type Region,
  type ResourceId,
  type WorkerClass,
  type Zone,
} from '@nomarque/data';
import { z } from 'zod';

// Every instant below is in game hours since the reign started, with its ISO
// 8601 real-time counterpart when the client shows a date or a countdown.

export type NilePhaseDto = 'akhet' | 'peret' | 'shemu';
export type ResourceAmountsDto = Partial<Record<ResourceId, number>>;

export interface NileDto {
  /** Zero-based Nile year of the reign. */
  year: number;
  phase: NilePhaseDto;
  hourOfYear: number;
  /** Flood of the current year, revealed at the start of Akhet. */
  flood: FloodLevel;
  nextPhase: NilePhaseDto;
  nextPhaseAt: number;
  nextPhaseAtIso: string;
}

export interface HouseBlockDto {
  level: 1 | 2 | 3 | 4;
  count: number;
}

export interface ParcelDto {
  slot: number;
  row: number;
  col: number;
  zone: Zone;
  building: BuildingId | null;
  houses: HouseBlockDto | null;
  /** Workers assigned by the player. */
  workers: number;
  /** Effective / required workers, null without a complete building. */
  occupancy: number | null;
  /** Output per Nile year at the current rates (workshops, raw buildings). */
  perYear: ResourceAmountsDto;
  /** Fields: expected harvest if the occupancy holds; null otherwise. */
  harvest: ResourceAmountsDto | null;
  /** Construction end, null once built. */
  buildEndsAt: number | null;
  buildEndsAtIso: string | null;
}

export interface ClassWorkforceDto {
  available: number;
  assigned: number;
  /** Share of each assignment actually filled, 0..1. */
  ratio: number;
}

export interface NomeDto {
  id: string;
  name: string;
  region: Region;
  dynastyName: string;
  deben: number;
  favor: number;
  /** Instant the state is computed at: the request time. */
  gameHours: number;
  nile: NileDto;
  stocks: ResourceAmountsDto;
  /** Storage capacity per resource. */
  capacity: number;
  workforce: Record<WorkerClass, ClassWorkforceDto>;
  /** Ordered by slot. */
  parcels: ParcelDto[];
  /** Version of the game data the reign runs on. */
  dataVersion: string;
}

export interface HouseLevelChangeDto {
  slot: number;
  at: number;
  from: number;
  to: number;
}

/**
 * The steward's report: everything that happened since the player last
 * acknowledged it.
 */
export interface StewardReportDto {
  from: number;
  to: number;
  produced: ResourceAmountsDto;
  consumed: ResourceAmountsDto;
  lost: ResourceAmountsDto;
  harvested: ResourceAmountsDto;
  tribute: ResourceAmountsDto;
  tributeMissing: ResourceAmountsDto;
  shortages: ResourceAmountsDto;
  taxes: number;
  completed: number[];
  houseChanges: HouseLevelChangeDto[];
  houseWarnings: { slot: number; at: number }[];
}

/**
 * Answer of GET /worlds/:id/nome/state and of every action on the nome: the
 * nome advanced to now, with the pending report.
 */
export interface NomeStateResponse {
  nome: NomeDto;
  report: StewardReportDto;
}

export const buildRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('building'), building: z.enum(BUILDING_IDS) }),
  z.object({ kind: z.literal('houses') }),
]);
export type BuildRequest = z.infer<typeof buildRequestSchema>;

export const assignWorkersRequestSchema = z.object({
  workers: z.number().int().min(0).max(1000),
});
export type AssignWorkersRequest = z.infer<typeof assignWorkersRequestSchema>;

/**
 * Codes of a refused action, in ApiErrorDto.code (HTTP 422). They mirror the
 * ActionError of libs/rules.
 */
export const NOME_ACTION_ERRORS = [
  'unknown_parcel',
  'parcel_not_empty',
  'zone_not_allowed',
  'not_enough_deben',
  'no_building',
  'invalid_workers',
] as const;
export type NomeActionErrorCode = (typeof NOME_ACTION_ERRORS)[number];
