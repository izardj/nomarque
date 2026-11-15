import { GAME_DATA } from '@nomarque/data';
import { REIGN_YEARS, reignLengthHours, toRealMs } from '@nomarque/rules';
import type { PrismaClient, Reign, ReignStatus, World } from './prisma';

export interface SeedWorldOptions {
  /** World name. It is unique in the database, so it also identifies the world. */
  name: string;
  /** Nile years per real week. */
  speed: number;
  /** Real instant at which the next reign starts. */
  reignStartsAt: Date;
}

export interface SeedWorldResult {
  world: World;
  /** The created reign, or the active one that blocked the creation. */
  reign: Reign;
  /** Whether this call created a reign. */
  created: boolean;
}

/** Reigns in these statuses still occupy the world: no new one may start. */
const ACTIVE_REIGN_STATUSES: ReignStatus[] = [
  'SCHEDULED',
  'RUNNING',
  'FUNERALS',
];

/**
 * Creates the test world and its first reign if they are missing. Running it
 * again is a no-op while the world has an active reign, so a developer can seed
 * the same database repeatedly.
 */
export async function seedWorld(
  prisma: PrismaClient,
  options: SeedWorldOptions,
  now: Date,
): Promise<SeedWorldResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.world.findUnique({
      where: { name: options.name },
    });
    let world: World;
    if (existing) {
      // An existing world keeps its speed: changing it would warp a reign that
      // players may already be running.
      world = existing;
      if (existing.speed !== options.speed) {
        console.warn(
          `world "${world.name}" already exists with speed ${existing.speed}; keeping it (requested ${options.speed}).`,
        );
      }
    } else {
      world = await tx.world.create({
        data: { name: options.name, speed: options.speed, status: 'OPEN' },
      });
    }

    const active = await tx.reign.findFirst({
      where: { worldId: world.id, status: { in: ACTIVE_REIGN_STATUSES } },
      orderBy: { number: 'desc' },
    });
    if (active) {
      console.log(
        `world "${world.name}" already has reign ${active.number} (${active.status}); no reign created.`,
      );
      return { world, reign: active, created: false };
    }

    const highest = await tx.reign.aggregate({
      where: { worldId: world.id },
      _max: { number: true },
    });
    const number = (highest._max.number ?? 0) + 1;
    const startsAt = options.reignStartsAt;
    const endsAt = new Date(
      startsAt.getTime() +
        toRealMs(reignLengthHours(GAME_DATA.parameters), world.speed),
    );
    const reign = await tx.reign.create({
      data: {
        worldId: world.id,
        number,
        dataVersion: GAME_DATA.version,
        status: startsAt.getTime() <= now.getTime() ? 'RUNNING' : 'SCHEDULED',
        startsAt,
        endsAt,
      },
    });
    await tx.nileYear.createMany({
      data: Array.from({ length: REIGN_YEARS }, (_, index) => ({
        reignId: reign.id,
        index,
        floodLevel: 'GOOD' as const,
        // Flood draws arrive with the Nile cycle (milestone J2).
        revealedAt: null,
      })),
    });
    return { world, reign, created: true };
  });
}
