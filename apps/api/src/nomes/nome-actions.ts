import { HttpStatus } from '@nestjs/common';
import type { BuildRequest, NomeActionErrorCode } from '@nomarque/contracts';
import { GAME_DATA } from '@nomarque/data';
import type { Prisma } from '@nomarque/db';
import {
  assignWorkers,
  build,
  type ActionError,
  type ActionResult,
  type NomeState,
} from '@nomarque/rules';
import { apiError } from '../common/api-error';

/** What the pipeline runs once the nome is locked and advanced to now. */
export interface NomeAction {
  /** Validates and applies the action at game hour `now`. */
  apply(state: NomeState, now: number): ActionResult;
  /** Recorded in the ActionLog when the action succeeds. */
  log?: { type: string; payload: Prisma.InputJsonObject };
  /** Empties the steward's report instead of keeping it. */
  clearsReport?: boolean;
}

const REFUSALS: Record<NomeActionErrorCode, string> = {
  unknown_parcel: "Cette parcelle n'existe pas.",
  parcel_not_empty: 'Cette parcelle est déjà occupée.',
  zone_not_allowed: 'Cette construction est impossible dans cette zone.',
  not_enough_deben: "Tu n'as pas assez de deben.",
  no_building: "Il n'y a pas de bâtiment sur cette parcelle.",
  invalid_workers: "Ce nombre d'ouvriers ne convient pas à ce bâtiment.",
};

/** The 422 answer for an action refused by libs/rules. */
export function refusal(error: ActionError): Error {
  return apiError(HttpStatus.UNPROCESSABLE_ENTITY, error, REFUSALS[error]);
}

export function buildAction(slot: number, request: BuildRequest): NomeAction {
  return {
    apply: (state, now) => build(state, GAME_DATA, slot, request, now),
    log: { type: 'nome.build', payload: { slot, ...request } },
  };
}

export function assignWorkersAction(slot: number, workers: number): NomeAction {
  return {
    apply: (state) => assignWorkers(state, GAME_DATA, slot, workers),
    log: { type: 'nome.workers', payload: { slot, workers } },
  };
}

export const acknowledgeReportAction: NomeAction = {
  apply: (state) => ({ ok: true, state }),
  clearsReport: true,
};
