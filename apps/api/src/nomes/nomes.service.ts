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
  advance,
  emptyReport,
  gameHours,
  mergeReports,
  reignLengthHours,
  type CardDealt,
  type RulesContext,
} from '@nomarque/rules';
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
import { NomesRepository, type SettledCard } from './nomes.repository';

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
    await this.nomes.lock(tx, nome.id);
    // Read after the lock: a queued request must see the previous one's write.
    const stored = await this.nomes.load(tx, nome.id);

    const reignLength = reignLengthHours(GAME_DATA.parameters);
    const now = Math.min(
      Math.max(0, gameHours(nome.clock, this.clock.now())),
      reignLength,
    );
    // Never go back in time, whatever the clock says.
    const at = Math.max(stored.computedAt, now);
    const context: RulesContext = {
      data: GAME_DATA,
      floods: nome.floods,
      seed: nome.id,
    };
    let state = stored.state;
    let pending = stored.pendingReport;
    const settled: SettledCard[] = [];
    const dealt: CardDealt[] = [];
    if (stored.computedAt < at) {
      const advanced = advance(state, stored.computedAt, at, context);
      state = advanced.state;
      pending = pending
        ? mergeReports(pending, advanced.report)
        : advanced.report;
      dealt.push(...advanced.report.cardsDealt);
      for (const card of advanced.report.cardsDefaulted) {
        settled.push({
          cardId: card.cardId,
          drawnAt: card.drawId * GAME_DATA.parameters.cardDrawIntervalHours,
          choice: card.choice,
          resolvedAt: card.at,
        });
      }
    }

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
    }

    if (stored.computedAt < at || action) {
      await this.nomes.save(tx, nome.id, stored.state, next, at, pending);
      await this.nomes.recordCardsDealt(
        tx,
        nome.id,
        dealt,
        GAME_DATA.parameters.cardGraceHours,
      );
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
