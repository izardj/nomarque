import { REGIONS, type Region } from '@nomarque/data';
import { z } from 'zod';

export type WorldStatusDto = 'open' | 'closed';
export type ReignStatusDto = 'scheduled' | 'running' | 'funerals' | 'ended';

export interface ReignDto {
  id: string;
  number: number;
  status: ReignStatusDto;
  /** ISO 8601. */
  startsAt: string;
  /** ISO 8601. */
  endsAt: string;
  /** Game hours elapsed since the reign started, at response time. */
  gameHours: number;
  monumentProgress: number;
}

/** Answer of GET /worlds and GET /worlds/:id. */
export interface WorldDto {
  id: string;
  name: string;
  /** Nile years per real week. */
  speed: number;
  status: WorldStatusDto;
  /** Current reign, null when none is running or scheduled. */
  reign: ReignDto | null;
}

export const DYNASTY_NAME_MAX = 40;
export const NOME_NAME_MAX = 40;

export const joinWorldSchema = z.object({
  region: z.enum(REGIONS),
  /** Required when the player has no dynasty yet, ignored otherwise. */
  dynastyName: z.string().trim().min(2).max(DYNASTY_NAME_MAX).optional(),
  nomeName: z.string().trim().min(2).max(NOME_NAME_MAX),
});
export type JoinWorldRequest = z.infer<typeof joinWorldSchema>;

export interface NomeSummaryDto {
  id: string;
  reignId: string;
  name: string;
  region: Region;
  dynastyName: string;
  deben: number;
  favor: number;
}

/** Answer of POST /worlds/:id/join. */
export interface JoinWorldResponse {
  nome: NomeSummaryDto;
}

/** Answer of GET /worlds/:id/nome: the player's nome in the current reign. */
export interface MyNomeResponse {
  nome: NomeSummaryDto | null;
}
