import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type {
  AssignWorkersRequest,
  BuildRequest,
  NomeStateResponse,
} from '@nomarque/contracts';
import { GAME_DATA } from '@nomarque/data';
import type { Prisma } from '@nomarque/db';
import {
  advance,
  emptyReport,
  gameHours,
  mergeReports,
  reignLengthHours,
} from '@nomarque/rules';
import { apiError } from '../common/api-error';
import { CLOCK, type Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import {
  acknowledgeReportAction,
  assignWorkersAction,
  buildAction,
  refusal,
  type NomeAction,
} from './nome-actions';
import { toNomeStateResponse } from './nomes.mapper';
import { NomesRepository } from './nomes.repository';

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

    const now = Math.min(
      Math.max(0, gameHours(nome.clock, this.clock.now())),
      reignLengthHours(GAME_DATA.parameters),
    );
    // Never go back in time, whatever the clock says.
    const at = Math.max(stored.computedAt, now);
    let state = stored.state;
    let pending = stored.pendingReport;
    if (stored.computedAt < at) {
      const advanced = advance(state, stored.computedAt, at, {
        data: GAME_DATA,
        floods: nome.floods,
      });
      state = advanced.state;
      pending = pending
        ? mergeReports(pending, advanced.report)
        : advanced.report;
    }

    let next = state;
    if (action) {
      const result = action.apply(state, at);
      if (!result.ok) {
        throw refusal(result.error);
      }
      next = result.state;
      if (action.clearsReport) {
        pending = null;
      }
    }

    if (stored.computedAt < at || action) {
      await this.nomes.save(tx, nome.id, stored.state, next, at, pending);
    }
    if (action?.log) {
      await tx.actionLog.create({ data: { nomeId: nome.id, ...action.log } });
    }
    return toNomeStateResponse({
      nome,
      favor: stored.favor,
      at,
      state: next,
      report: pending ?? emptyReport(at, at),
    });
  }
}
