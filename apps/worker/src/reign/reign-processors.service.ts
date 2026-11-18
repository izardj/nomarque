import { Inject, Injectable } from '@nestjs/common';
import { GAME_DATA } from '@nomarque/data';
import {
  createReign,
  type Prisma,
  type RankingCategory,
  type Reign,
} from '@nomarque/db';
import { advanceNomeTo, NomesRepository } from '@nomarque/nome-store';
import {
  RANKING_CATEGORIES,
  rankScores,
  realInstantMs,
  reignLengthHours,
  reignScores,
  type ReignScores,
  type RulesContext,
} from '@nomarque/rules';
import { CLOCK, type Clock } from '../common/clock';
import { PrismaService } from '../prisma/prisma.service';
import { phaseStartHour, type PhaseName } from './reign-plan';

const CATEGORY_TO_DB = {
  wealth: 'WEALTH',
  piety: 'PIETY',
  royalFavor: 'ROYAL_FAVOR',
} as const satisfies Record<
  (typeof RANKING_CATEGORIES)[number],
  RankingCategory
>;

/**
 * What each job does to the database. Every method is idempotent: the
 * database, not the queue, says whether the work is already done, so a job
 * delivered twice or late changes nothing the second time.
 */
@Injectable()
export class ReignProcessors {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nomes: NomesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** SCHEDULED becomes RUNNING. */
  async start(reignId: string): Promise<void> {
    await this.prisma.client.reign.updateMany({
      where: { id: reignId, status: 'SCHEDULED' },
      data: { status: 'RUNNING' },
    });
  }

  /** Akhet reveals the flood of its year; the funerals close the reign. */
  async phase(reignId: string, year: number, phase: PhaseName): Promise<void> {
    const db = this.prisma.client;
    if (phase === 'akhet') {
      const reign = await db.reign.findUniqueOrThrow({
        where: { id: reignId },
        include: { world: true },
      });
      // Dated at the planned boundary, so a late or repeated run agrees.
      const revealedAt = new Date(
        realInstantMs(
          { startsAtMs: reign.startsAt.getTime(), speed: reign.world.speed },
          phaseStartHour(year, phase),
        ),
      );
      await db.nileYear.updateMany({
        where: { reignId, index: year, revealedAt: null },
        data: { revealedAt },
      });
    } else if (phase === 'funerals') {
      await db.reign.updateMany({
        where: { id: reignId, status: { in: ['SCHEDULED', 'RUNNING'] } },
        data: { status: 'FUNERALS' },
      });
    }
  }

  /**
   * Advances every nome to the end of the reign, freezes the rankings, pays
   * the prestige, ends the reign and creates the next one. Returns the next
   * reign, or null when the reign had already ended.
   */
  async end(reignId: string): Promise<Reign | null> {
    const db = this.prisma.client;
    const reign = await db.reign.findUniqueOrThrow({ where: { id: reignId } });
    if (reign.status === 'ENDED') {
      return null;
    }
    const nomeIds = (
      await db.nome.findMany({ where: { reignId }, select: { id: true } })
    ).map((nome) => nome.id);
    const floods = await this.nomes.floods(db, reignId);
    const length = reignLengthHours(GAME_DATA.parameters);
    const contextOf = (nomeId: string): RulesContext => ({
      data: GAME_DATA,
      floods,
      seed: nomeId,
    });
    // One transaction per nome: a failure leaves the others advanced.
    for (const nomeId of nomeIds) {
      await db.$transaction((tx) =>
        advanceNomeTo(this.nomes, tx, nomeId, length, contextOf(nomeId)),
      );
    }
    return db.$transaction((tx) => this.closeReign(tx, reign, contextOf));
  }

  private async closeReign(
    tx: Prisma.TransactionClient,
    reign: Reign,
    contextOf: (nomeId: string) => RulesContext,
  ): Promise<Reign | null> {
    // The first to flip the status owns the closing; a concurrent run waits
    // on this row, then finds the reign ended.
    const flipped = await tx.reign.updateMany({
      where: { id: reign.id, status: { not: 'ENDED' } },
      data: { status: 'ENDED' },
    });
    if (flipped.count === 0) {
      return null;
    }
    const length = reignLengthHours(GAME_DATA.parameters);
    const nomes = await tx.nome.findMany({
      where: { reignId: reign.id },
      select: { id: true, dynastyId: true },
    });
    const scored: { nome: (typeof nomes)[number]; scores: ReignScores }[] = [];
    for (const nome of nomes) {
      // A no-op for a nome already advanced; catches one that joined since.
      const stored = await advanceNomeTo(
        this.nomes,
        tx,
        nome.id,
        length,
        contextOf(nome.id),
      );
      scored.push({ nome, scores: reignScores(stored.state, GAME_DATA) });
    }

    const prestige = new Map<string, number>();
    for (const category of RANKING_CATEGORIES) {
      const ranked = rankScores(
        scored.map(({ nome, scores }) => ({
          key: nome,
          score: scores[category],
        })),
        GAME_DATA,
      );
      await tx.reignRanking.createMany({
        data: ranked.map((line) => ({
          reignId: reign.id,
          category: CATEGORY_TO_DB[category],
          nomeId: line.key.id,
          rank: line.rank,
          score: line.score,
          prestige: line.prestige,
        })),
      });
      for (const line of ranked) {
        const { dynastyId } = line.key;
        prestige.set(dynastyId, (prestige.get(dynastyId) ?? 0) + line.prestige);
      }
    }
    for (const [dynastyId, earned] of prestige) {
      await tx.dynasty.update({
        where: { id: dynastyId },
        data: { prestige: { increment: earned } },
      });
    }

    const world = await tx.world.findUniqueOrThrow({
      where: { id: reign.worldId },
    });
    return createReign(tx, world, reign.endsAt, new Date(this.clock.now()));
  }
}
