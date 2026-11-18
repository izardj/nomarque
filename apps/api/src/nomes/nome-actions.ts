import { HttpStatus } from '@nestjs/common';
import type { BuildRequest, NomeActionErrorCode } from '@nomarque/contracts';
import {
  GAME_DATA,
  type BuildingId,
  type CardChoiceKey,
  type God,
} from '@nomarque/data';
import type { Prisma } from '@nomarque/db';
import {
  assignWorkers,
  build,
  chooseCard,
  chooseCrop,
  makeOffering,
  type ActionResult,
  type NomeState,
  type RulesContext,
} from '@nomarque/rules';
import { apiError } from '../common/api-error';

/** What the pipeline runs once the nome is locked and advanced to now. */
export interface NomeAction {
  /** Validates and applies the action at game hour `now`. */
  apply(state: NomeState, now: number, context: RulesContext): ActionResult;
  /** Recorded in the ActionLog when the action succeeds. */
  log?: { type: string; payload: Prisma.InputJsonObject };
  /** Empties the steward's report instead of keeping it. */
  clearsReport?: boolean;
  /** Still accepted once the reign is over. */
  allowedWhenOver?: boolean;
  /** The pending card this action settles, for the card history. */
  settlesCard?: { drawId: number; choice: CardChoiceKey };
}

const REFUSALS: Record<NomeActionErrorCode, string> = {
  unknown_parcel: "Cette parcelle n'existe pas.",
  parcel_not_empty: 'Cette parcelle est déjà occupée.',
  zone_not_allowed: 'Cette construction est impossible dans cette zone.',
  not_enough_deben: "Tu n'as pas assez de deben.",
  no_building: "Il n'y a pas de bâtiment sur cette parcelle.",
  invalid_workers: "Ce nombre d'ouvriers ne convient pas à ce bâtiment.",
  not_a_field: "Cette parcelle n'est pas un champ.",
  crops_locked: 'Les cultures ne se changent plus après la crue.',
  offering_too_soon: 'Les dieux ont déjà reçu ton offrande du jour.',
  not_enough_resources: "Tu n'as pas de quoi faire cette offrande.",
  unknown_card: "Cette carte n'est plus en attente.",
  unknown_choice: "Ce choix n'existe pas pour cette carte.",
  cannot_afford: "Tu n'as pas de quoi payer ce choix.",
  reign_over: 'Le règne est terminé : plus aucune action possible.',
};

/** The 422 answer for an action refused by libs/rules. */
export function refusal(error: NomeActionErrorCode): Error {
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

export function chooseCropAction(slot: number, crop: BuildingId): NomeAction {
  return {
    apply: (state, now) => chooseCrop(state, GAME_DATA, slot, crop, now),
    log: { type: 'nome.crop', payload: { slot, crop } },
  };
}

export function offeringAction(god: God): NomeAction {
  return {
    apply: (state, now) => makeOffering(state, GAME_DATA, god, now),
    log: { type: 'nome.offering', payload: { god } },
  };
}

export function chooseCardAction(
  drawId: number,
  choice: CardChoiceKey,
): NomeAction {
  return {
    apply: (state, now, context) =>
      chooseCard(state, context, drawId, choice, now),
    log: { type: 'nome.card', payload: { drawId, choice } },
    settlesCard: { drawId, choice },
  };
}

export const acknowledgeReportAction: NomeAction = {
  apply: (state) => ({ ok: true, state }),
  clearsReport: true,
  allowedWhenOver: true,
};
