import { createReign } from './create-reign';
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

    const reign = await createReign(tx, world, options.reignStartsAt, now);
    return { world, reign, created: true };
  });
}
