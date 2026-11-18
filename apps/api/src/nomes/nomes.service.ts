import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AssignWorkersRequest,
  BuildRequest,
  CardChoiceRequest,
  CropRequest,
  NomeStateResponse,
  OfferingRequest,
} from '@nomarque/contracts';
import { GAME_DATA } from '@nomarque/data';
import type { Prisma } from '@nomarque/db';
import {
  emptyReport,
  gameHours,
  reignLengthHours,
  type RulesContext,
} from '@nomarque/rules';
import {
  advanceNomeTo,
  NomesRepository,
  type SettledCard,
} from '@nomarque/nome-store';
import { apiError } from '../common/api-error';
import { CLOCK, type Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import {
  acknowledgeReportAction,
  assignWorkersAction,
  buildAction,
  chooseCardAction,
  chooseCropAction,
  offeringAction,
  refusal,
  type NomeAction,
} from './nome-actions';
import { toNomeStateResponse } from './nomes.mapper';

function nomeNotFound(): Error {
  return apiError(
    HttpStatus.NOT_FOUND,
    'nome_not_found',
    "Tu n'as pas de nome dans ce monde.",
  );
}

@Injectable()
export class NomesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nomes: NomesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  read(playerId: string, worldId: string): Promise<NomeStateResponse> {
    return this.runAction(playerId, worldId);
  }

  build(
    playerId: string,
    worldId: string,
    slot: number,
    request: BuildRequest,
  ): Promise<NomeStateResponse> {
    return this.runAction(playerId, worldId, buildAction(slot, request));
  }

  assignWorkers(
    playerId: string,
    worldId: string,
    slot: number,
    request: AssignWorkersRequest,
  ): Promise<NomeStateResponse> {
    return this.runAction(
      playerId,
      worldId,
      assignWorkersAction(slot, request.workers),
    );
  }

  chooseCrop(
    playerId: string,
    worldId: string,
    slot: number,
    request: CropRequest,
  ): Promise<NomeStateResponse> {
    return this.runAction(
      playerId,
      worldId,
      chooseCropAction(slot, request.crop),
    );
  }

  makeOffering(
    playerId: string,
    worldId: string,
    request: OfferingRequest,
  ): Promise<NomeStateResponse> {
    return this.runAction(playerId, worldId, offeringAction(request.god));
  }

  chooseCard(
    playerId: string,
    worldId: string,
    drawId: number,
    request: CardChoiceRequest,
  ): Promise<NomeStateResponse> {
    return this.runAction(
      playerId,
      worldId,
      chooseCardAction(drawId, request.choice),
    );
  }

  acknowledgeReport(
    playerId: string,
    worldId: string,
  ): Promise<NomeStateResponse> {
    return this.runAction(playerId, worldId, acknowledgeReportAction);
  }

  /**
   * The single pipeline of every route: lock the nome, advance it to now,
   * validate and apply the action, write, log, answer. Without an action it
   * is a read. A refused action throws before anything is written.
   */
  runAction(
    playerId: string,
    worldId: string,
    action?: NomeAction,
  ): Promise<NomeStateResponse> {
    return this.prisma.client.$transaction((tx) =>
      this.runInTransaction(tx, playerId, worldId, action),
    );
  }

  private async runInTransaction(
    tx: Prisma.TransactionClient,
    playerId: string,
    worldId: string,
    action?: NomeAction,
  ): Promise<NomeStateResponse> {
    const nome = await this.nomes.findCurrent(tx, playerId, worldId);
    if (!nome) {
      throw nomeNotFound();
    }
    const reignLength = reignLengthHours(GAME_DATA.parameters);
    const now = Math.min(
      Math.max(0, gameHours(nome.clock, this.clock.now())),
      reignLength,
    );
    const context: RulesContext = {
      data: GAME_DATA,
      floods: nome.floods,
      seed: nome.id,
    };
    const advanced = await advanceNomeTo(this.nomes, tx, nome.id, now, context);
    // Never go back in time, whatever the clock says.
    const at = advanced.computedAt;
    const state = advanced.state;
    let pending = advanced.pendingReport;

    let next = state;
    if (action) {
      if (at >= reignLength && !action.allowedWhenOver) {
        throw refusal('reign_over');
      }
      const result = action.apply(state, at, context);
      if (!result.ok) {
        throw refusal(result.error);
      }
      next = result.state;
      if (action.clearsReport) {
        pending = null;
      }
      const settled: SettledCard[] = [];
      const card = action.settlesCard;
      const drawn = state.rules.cards.pending.find(
        (c) => c.drawId === card?.drawId,
      );
      if (card && drawn) {
        settled.push({
          cardId: drawn.cardId,
          drawnAt: drawn.drawnAt,
          choice: card.choice,
          resolvedAt: at,
        });
      }
      await this.nomes.save(tx, nome.id, state, next, at, pending);
      await this.nomes.recordCardsSettled(tx, nome.id, settled);
    }
    if (action?.log) {
      await tx.actionLog.create({ data: { nomeId: nome.id, ...action.log } });
    }
    return toNomeStateResponse({
      nome,
      at,
      state: next,
      report: pending ?? emptyReport(at, at),
    });
  }
}
