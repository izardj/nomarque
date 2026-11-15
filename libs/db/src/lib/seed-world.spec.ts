import { GAME_DATA } from '@nomarque/data';
import { createPrismaClient, type PrismaClient } from './prisma';
import { seedWorld, type SeedWorldOptions } from './seed-world';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
const WORLD_NAME = 'Nil de test';
// 7 Nile years per real week: a reign of 4 years lasts 4 real days.
const SPEED = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_START = '2026-01-05T10:00:00.000Z';

describe.skipIf(!databaseUrl)('seedWorld', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient(databaseUrl);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE "World" CASCADE');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  function options(reignStartsAt: string): SeedWorldOptions {
    return {
      name: WORLD_NAME,
      speed: SPEED,
      reignStartsAt: new Date(reignStartsAt),
    };
  }

  it('creates the world, its first reign and four Nile years', async () => {
    const now = new Date('2026-01-05T10:05:00.000Z');

    const { world, reign, created } = await seedWorld(
      prisma,
      options(FIRST_START),
      now,
    );

    expect(created).toBe(true);
    expect(world.name).toBe(WORLD_NAME);
    expect(world.speed).toBe(SPEED);
    expect(world.status).toBe('OPEN');
    expect(reign.worldId).toBe(world.id);
    expect(reign.number).toBe(1);
    expect(reign.status).toBe('RUNNING');
    expect(reign.dataVersion).toBe(GAME_DATA.version);
    expect(reign.startsAt.toISOString()).toBe(FIRST_START);
    expect(reign.endsAt.getTime() - reign.startsAt.getTime()).toBe(4 * DAY_MS);

    const years = await prisma.nileYear.findMany({
      where: { reignId: reign.id },
      orderBy: { index: 'asc' },
    });
    expect(years.map((year) => year.index)).toEqual([0, 1, 2, 3]);
    for (const year of years) {
      expect(year.floodLevel).toBe('GOOD');
      expect(year.revealedAt).toBeNull();
    }
  });

  it('creates nothing on a second call while the reign is active', async () => {
    const now = new Date('2026-01-05T10:05:00.000Z');
    const first = await seedWorld(prisma, options(FIRST_START), now);

    const second = await seedWorld(prisma, options(FIRST_START), now);

    expect(second.created).toBe(false);
    expect(second.world.id).toBe(first.world.id);
    expect(second.reign.id).toBe(first.reign.id);
    expect(await prisma.world.count()).toBe(1);
    expect(await prisma.reign.count()).toBe(1);
    expect(await prisma.nileYear.count()).toBe(4);
  });

  it('creates the next reign once the previous one ended', async () => {
    await seedWorld(
      prisma,
      options(FIRST_START),
      new Date('2026-01-05T10:05:00.000Z'),
    );
    await prisma.reign.updateMany({ data: { status: 'ENDED' } });

    const nextStart = '2026-01-09T10:00:00.000Z';
    const { reign, created } = await seedWorld(
      prisma,
      options(nextStart),
      new Date('2026-01-09T10:05:00.000Z'),
    );

    expect(created).toBe(true);
    expect(reign.number).toBe(2);
    expect(reign.startsAt.toISOString()).toBe(nextStart);
    expect(await prisma.reign.count()).toBe(2);
    expect(await prisma.nileYear.count()).toBe(8);
  });

  it('schedules a reign that starts in the future', async () => {
    const now = new Date('2026-01-05T10:05:00.000Z');

    const { reign } = await seedWorld(
      prisma,
      options('2026-01-06T10:00:00.000Z'),
      now,
    );

    expect(reign.status).toBe('SCHEDULED');
  });
});
