import { Test } from '@nestjs/testing';
import { GAME_DATA } from '@nomarque/data';
import {
  createReign,
  type PrismaClient,
  type Reign,
  type World,
} from '@nomarque/db';
import { NomesRepository } from '@nomarque/nome-store';
import { foundNome, reignLengthHours, toRealMs } from '@nomarque/rules';
import { Queue } from 'bullmq';
import { CLOCK, type Clock } from '../common/clock';
import { ENV } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { BullJobScheduler, REIGN_QUEUE } from './bull-job-scheduler';
import { JobScheduler } from './job-scheduler';
import { planReign, type PlannedJob } from './reign-plan';
import { ReignProcessors } from './reign-processors.service';
import { ReignScheduleService } from './reign-schedule.service';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const redisUrl = process.env['REDIS_URL'] ?? '';
const HOUR_MS = 3_600_000;
// 7 Nile years per real week: a Nile year lasts 24 real hours.
const SPEED = 7;
const T0 = new Date('2026-01-05T10:00:00.000Z');
const { yearHours } = GAME_DATA.parameters;
const YEAR_MS = toRealMs(yearHours, SPEED);
const LENGTH = reignLengthHours(GAME_DATA.parameters);
const REIGN_MS = toRealMs(LENGTH, SPEED);
const prestige = GAME_DATA.parameters;

class FakeClock implements Clock {
  constructor(public ms: number) {}
  now(): number {
    return this.ms;
  }
}

/** Records the jobs it is asked to queue; a known id is left as it is. */
class FakeScheduler implements JobScheduler {
  readonly scheduled: { planned: PlannedJob; delayMs: number }[] = [];

  async schedule(planned: PlannedJob, delayMs: number): Promise<void> {
    if (!this.scheduled.some((s) => s.planned.jobId === planned.jobId)) {
      this.scheduled.push({ planned, delayMs });
    }
  }

  ids(): string[] {
    return this.scheduled.map((s) => s.planned.jobId);
  }
}

interface NomeSetup {
  name: string;
  deben?: number;
  favor?: number;
  /** Game hour the nome is computed to; the reign length leaves nothing to advance. */
  computedAt?: number;
}

describe.skipIf(!databaseUrl)('reign lifecycle', () => {
  let prisma: PrismaClient;
  let processors: ReignProcessors;
  let schedule: ReignScheduleService;
  // Built once and reset before each test: the module holds these instances.
  const scheduler = new FakeScheduler();
  const clock = new FakeClock(T0.getTime());
  let world: World;
  let emailCounter = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        NomesRepository,
        ReignProcessors,
        ReignScheduleService,
        {
          provide: ENV,
          useValue: { DATABASE_URL: databaseUrl, REDIS_URL: redisUrl },
        },
        { provide: CLOCK, useValue: clock },
        { provide: JobScheduler, useValue: scheduler },
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService).client;
    processors = moduleRef.get(ReignProcessors);
    schedule = moduleRef.get(ReignScheduleService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "World", "Player", "Dynasty" CASCADE',
    );
    scheduler.scheduled.length = 0;
    clock.ms = T0.getTime();
    world = await prisma.world.create({
      data: { name: 'Nil de test', speed: SPEED, status: 'OPEN' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** The first reign of the world, started at T0 (now follows the clock). */
  function openReign(): Promise<Reign> {
    return prisma.$transaction((tx) =>
      createReign(tx, world, T0, new Date(clock.now())),
    );
  }

  async function addNome(reign: Reign, setup: NomeSetup): Promise<string> {
    emailCounter += 1;
    const player = await prisma.player.create({
      data: { email: `player${emailCounter}@example.test` },
    });
    const dynasty = await prisma.dynasty.create({
      data: { playerId: player.id, name: `Dynasty ${setup.name}` },
    });
    const city = foundNome(GAME_DATA);
    const nome = await prisma.nome.create({
      data: {
        reignId: reign.id,
        dynastyId: dynasty.id,
        name: setup.name,
        region: 'DELTA',
        deben: setup.deben ?? city.deben,
        favor: setup.favor ?? 0,
        computedAt: setup.computedAt ?? 0,
        rulesState: JSON.parse(JSON.stringify(city.rules)),
      },
    });
    await prisma.$transaction((tx) =>
      new NomesRepository().insertCity(tx, nome.id, city),
    );
    return nome.id;
  }

  async function revealedYears(reign: Reign): Promise<number[]> {
    const years = await prisma.nileYear.findMany({
      where: { reignId: reign.id, revealedAt: { not: null } },
      orderBy: { index: 'asc' },
    });
    return years.map((year) => year.index);
  }

  async function rankingOf(
    reign: Reign,
    category: 'WEALTH' | 'PIETY' | 'ROYAL_FAVOR',
  ) {
    const lines = await prisma.reignRanking.findMany({
      where: { reignId: reign.id, category },
      include: { nome: true },
      orderBy: [{ rank: 'asc' }, { nome: { name: 'asc' } }],
    });
    return lines.map((line) => ({
      name: line.nome.name,
      rank: line.rank,
      score: line.score,
      prestige: line.prestige,
    }));
  }

  describe('reign.start', () => {
    it('turns a scheduled reign into a running one, once', async () => {
      clock.ms = T0.getTime() - HOUR_MS;
      const reign = await openReign();
      expect(reign.status).toBe('SCHEDULED');

      await processors.start(reign.id);
      await processors.start(reign.id);

      const after = await prisma.reign.findUniqueOrThrow({
        where: { id: reign.id },
      });
      expect(after.status).toBe('RUNNING');
    });

    it('leaves an ended reign alone', async () => {
      const reign = await openReign();
      await prisma.reign.update({
        where: { id: reign.id },
        data: { status: 'ENDED' },
      });

      await processors.start(reign.id);

      const after = await prisma.reign.findUniqueOrThrow({
        where: { id: reign.id },
      });
      expect(after.status).toBe('ENDED');
    });
  });

  describe('nile.phase', () => {
    it('reveals the flood of the year at the start of Akhet, once', async () => {
      const reign = await openReign();

      await processors.phase(reign.id, 1, 'akhet');
      await processors.phase(reign.id, 1, 'akhet');

      expect(await revealedYears(reign)).toEqual([1]);
      const year = await prisma.nileYear.findFirstOrThrow({
        where: { reignId: reign.id, index: 1 },
      });
      expect(year.revealedAt).toEqual(new Date(T0.getTime() + YEAR_MS));
    });

    it('does not reveal anything at the start of Peret or Shemu', async () => {
      const reign = await openReign();

      await processors.phase(reign.id, 0, 'peret');
      await processors.phase(reign.id, 0, 'shemu');

      expect(await revealedYears(reign)).toEqual([]);
    });

    it('starts the funerals 24 game hours before the end of the last year', async () => {
      const reign = await openReign();
      const funerals = planReign(reign, SPEED).find(
        (p) => p.job.name === 'nile.phase' && p.job.phase === 'funerals',
      )!;
      const lastYearStart = T0.getTime() + 3 * YEAR_MS;
      expect(funerals.dueMs).toBe(
        lastYearStart + toRealMs(yearHours - 24, SPEED),
      );

      clock.ms = funerals.dueMs - 1;
      await schedule.scheduleReign(reign.id);
      expect(await statusOf(reign)).toBe('RUNNING');
      expect(
        scheduler.scheduled.find((s) => s.planned.jobId === funerals.jobId)
          ?.delayMs,
      ).toBe(1);

      clock.ms = funerals.dueMs;
      await schedule.scheduleReign(reign.id);
      expect(await statusOf(reign)).toBe('FUNERALS');
    });
  });

  async function statusOf(reign: Reign): Promise<string> {
    return (await prisma.reign.findUniqueOrThrow({ where: { id: reign.id } }))
      .status;
  }

  describe('reign.end', () => {
    beforeEach(() => {
      clock.ms = T0.getTime() + REIGN_MS;
    });

    it('advances every nome, freezes the rankings, pays the prestige and opens the next reign', async () => {
      const reign = await openReign();
      await addNome(reign, { name: 'Abydos' });
      await addNome(reign, { name: 'Bubastis' });
      await addNome(reign, { name: 'Coptos' });

      const next = await processors.end(reign.id);

      const nomes = await prisma.nome.findMany({
        where: { reignId: reign.id },
      });
      expect(nomes).toHaveLength(3);
      for (const nome of nomes) {
        expect(nome.computedAt).toBe(LENGTH);
      }
      for (const category of ['WEALTH', 'PIETY', 'ROYAL_FAVOR'] as const) {
        const lines = await rankingOf(reign, category);
        expect(lines).toHaveLength(3);
        expect(lines[0]!.rank).toBe(1);
      }
      expect(await statusOf(reign)).toBe('ENDED');

      const earned = await prisma.reignRanking.groupBy({
        by: ['nomeId'],
        where: { reignId: reign.id },
        _sum: { prestige: true },
      });
      for (const { nomeId, _sum } of earned) {
        const nome = nomes.find((n) => n.id === nomeId)!;
        const dynasty = await prisma.dynasty.findUniqueOrThrow({
          where: { id: nome.dynastyId },
        });
        expect(dynasty.prestige).toBe(_sum.prestige);
        expect(dynasty.prestige).toBeGreaterThan(0);
      }

      expect(next).not.toBeNull();
      expect(next!.number).toBe(2);
      expect(next!.worldId).toBe(world.id);
      expect(next!.startsAt).toEqual(reign.endsAt);
      expect(next!.status).toBe('RUNNING');
      expect(
        await prisma.nileYear.count({ where: { reignId: next!.id } }),
      ).toBe(4);
    });

    it('ranks equal scores together and gives them the same prestige', async () => {
      const reign = await openReign();
      await addNome(reign, {
        name: 'Abydos',
        deben: 100,
        favor: 10,
        computedAt: LENGTH,
      });
      await addNome(reign, {
        name: 'Bubastis',
        deben: 100,
        favor: 20,
        computedAt: LENGTH,
      });
      await addNome(reign, {
        name: 'Coptos',
        deben: 50,
        favor: 20,
        computedAt: LENGTH,
      });

      await processors.end(reign.id);

      const wealth = await rankingOf(reign, 'WEALTH');
      expect(wealth.map((l) => [l.name, l.rank, l.prestige])).toEqual([
        ['Abydos', 1, prestige.prestigeFirst],
        ['Bubastis', 1, prestige.prestigeFirst],
        ['Coptos', 3, prestige.prestigeThird],
      ]);
      const piety = await rankingOf(reign, 'PIETY');
      expect(piety.map((l) => [l.rank, l.prestige])).toEqual([
        [1, prestige.prestigeFirst],
        [1, prestige.prestigeFirst],
        [1, prestige.prestigeFirst],
      ]);
      const favor = await rankingOf(reign, 'ROYAL_FAVOR');
      expect(favor.map((l) => [l.name, l.rank, l.score])).toEqual([
        ['Bubastis', 1, 20],
        ['Coptos', 1, 20],
        ['Abydos', 3, 10],
      ]);
      const abydos = await prisma.dynasty.findFirstOrThrow({
        where: { name: 'Dynasty Abydos' },
      });
      expect(abydos.prestige).toBe(
        prestige.prestigeFirst +
          prestige.prestigeFirst +
          prestige.prestigeThird,
      );
    });

    it('changes nothing when it runs a second time', async () => {
      const reign = await openReign();
      await addNome(reign, { name: 'Abydos' });
      await addNome(reign, { name: 'Bubastis' });
      await processors.end(reign.id);
      const snapshot = async () => ({
        rankings: await prisma.reignRanking.count(),
        reigns: await prisma.reign.count(),
        prestige: (
          await prisma.dynasty.findMany({ orderBy: { name: 'asc' } })
        ).map((d) => d.prestige),
      });
      const before = await snapshot();

      const again = await processors.end(reign.id);

      expect(again).toBeNull();
      expect(await snapshot()).toEqual(before);
      expect(before.rankings).toBe(6);
      expect(before.reigns).toBe(2);
    });

    it('ends a reign without nomes', async () => {
      const reign = await openReign();

      const next = await processors.end(reign.id);

      expect(await statusOf(reign)).toBe('ENDED');
      expect(next?.number).toBe(2);
      expect(await prisma.reignRanking.count()).toBe(0);
    });
  });

  describe('reconciliation', () => {
    it('queues the jobs still ahead of a scheduled reign with their delays', async () => {
      clock.ms = T0.getTime() - HOUR_MS;
      const reign = await openReign();

      await schedule.reconcile();

      const planned = planReign(reign, SPEED);
      expect(planned).toHaveLength(15);
      expect(scheduler.ids()).toEqual(planned.map((p) => p.jobId));
      expect(scheduler.scheduled[0]).toMatchObject({
        planned: { jobId: `reign.start_${reign.id}` },
        delayMs: HOUR_MS,
      });
      const end = scheduler.scheduled.at(-1)!;
      expect(end.planned.jobId).toBe(`reign.end_${reign.id}`);
      expect(end.delayMs).toBe(HOUR_MS + REIGN_MS);
      expect(await statusOf(reign)).toBe('SCHEDULED');
    });

    it('runs the overdue jobs in order and queues the others', async () => {
      const reign = await openReign();
      // 36 real hours in: year 1 has started and its Peret too, not its Shemu.
      clock.ms = T0.getTime() + 36 * HOUR_MS;

      await schedule.reconcile();

      const planned = planReign(reign, SPEED);
      const ahead = planned.filter((p) => p.dueMs > clock.ms);
      expect(ahead.length).toBeGreaterThan(0);
      expect(ahead.length).toBeLessThan(planned.length);
      expect(scheduler.ids()).toEqual(ahead.map((p) => p.jobId));
      for (const { planned: p, delayMs } of scheduler.scheduled) {
        expect(delayMs).toBe(p.dueMs - clock.ms);
      }
      expect(await revealedYears(reign)).toEqual([0, 1]);
      expect(await statusOf(reign)).toBe('RUNNING');
    });

    it('catches up after a downtime that spans the end of the reign', async () => {
      clock.ms = T0.getTime() - HOUR_MS;
      const reign = await openReign();
      await addNome(reign, { name: 'Abydos' });
      clock.ms = T0.getTime() + REIGN_MS + HOUR_MS;

      await schedule.reconcile();

      expect(await statusOf(reign)).toBe('ENDED');
      expect(await revealedYears(reign)).toEqual([0, 1, 2, 3]);
      const next = await prisma.reign.findFirstOrThrow({
        where: { number: 2 },
      });
      expect(next.status).toBe('RUNNING');
      expect(scheduler.ids()).toContain(`reign.end_${next.id}`);
      expect(scheduler.ids().every((id) => !id.includes(reign.id))).toBe(true);
    });

    it('ignores ended reigns', async () => {
      const reign = await openReign();
      await prisma.reign.update({
        where: { id: reign.id },
        data: { status: 'ENDED' },
      });

      await schedule.reconcile();

      expect(scheduler.scheduled).toEqual([]);
    });
  });
});

describe.skipIf(!redisUrl)('BullMQ scheduler', () => {
  it('queues a delayed job once per id', async () => {
    const queue = new Queue(REIGN_QUEUE, { connection: { url: redisUrl } });
    const scheduler = new BullJobScheduler({
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
    });
    const reignId = '00000000-0000-4000-8000-0000000000aa';
    const planned: PlannedJob = {
      job: { name: 'reign.end', reignId },
      jobId: `reign.end_${reignId}`,
      dueMs: 0,
    };
    try {
      await scheduler.schedule(planned, 60_000);
      await scheduler.schedule(planned, 120_000);

      const job = await queue.getJob(planned.jobId);
      expect(job?.name).toBe('reign.end');
      expect(job?.data).toEqual(planned.job);
      expect(job?.delay).toBe(60_000);
      expect(await queue.getDelayedCount()).toBeGreaterThanOrEqual(1);
    } finally {
      await queue.remove(planned.jobId);
      await scheduler.onApplicationShutdown();
      await queue.close();
    }
  });
});
