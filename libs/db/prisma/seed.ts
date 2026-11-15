import { createPrismaClient } from '../src/lib/prisma';
import { seedWorld, type SeedWorldOptions } from '../src/lib/seed-world';

const DEFAULT_WORLD_NAME = 'Nil de test';
/** Test speed: 7 Nile years per real week, so a reign lasts 4 real days. */
const DEFAULT_WORLD_SPEED = 7;

/** Rounds a real instant down to the whole minute. */
function floorToMinute(instant: Date): Date {
  return new Date(Math.floor(instant.getTime() / 60_000) * 60_000);
}

function readDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const value = env['DATABASE_URL'];
  if (!value) {
    throw new Error('DATABASE_URL is required');
  }
  return value;
}

function readSpeed(env: NodeJS.ProcessEnv): number {
  const raw = env['SEED_WORLD_SPEED'] ?? String(DEFAULT_WORLD_SPEED);
  const speed = Number(raw);
  if (!Number.isFinite(speed) || speed <= 0) {
    throw new Error(`SEED_WORLD_SPEED must be a positive number, got "${raw}"`);
  }
  return speed;
}

function readReignStartsAt(env: NodeJS.ProcessEnv, now: Date): Date {
  const raw = env['SEED_REIGN_STARTS_AT'];
  if (raw === undefined || raw.trim() === '') {
    return floorToMinute(now);
  }
  const startsAt = new Date(raw);
  if (Number.isNaN(startsAt.getTime())) {
    throw new Error(
      `SEED_REIGN_STARTS_AT must be an ISO 8601 date, got "${raw}"`,
    );
  }
  return startsAt;
}

async function main(): Promise<void> {
  const now = new Date();
  const options: SeedWorldOptions = {
    name: process.env['SEED_WORLD_NAME'] ?? DEFAULT_WORLD_NAME,
    speed: readSpeed(process.env),
    reignStartsAt: readReignStartsAt(process.env, now),
  };
  const prisma = createPrismaClient(readDatabaseUrl(process.env));
  try {
    const { world, reign, created } = await seedWorld(prisma, options, now);
    console.log(
      `World ${world.id} "${world.name}" (speed ${world.speed}, status ${world.status})`,
    );
    console.log(
      `Reign ${reign.number} (${reign.status}): startsAt ${reign.startsAt.toISOString()}, endsAt ${reign.endsAt.toISOString()}`,
    );
    console.log(created ? 'Reign created.' : 'No reign created.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
