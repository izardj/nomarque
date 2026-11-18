import { GAME_DATA } from '@nomarque/data';
import { REIGN_YEARS, reignLengthHours, toRealMs } from '@nomarque/rules';
import type { Prisma, Reign, World } from './prisma';

/**
 * Creates the next reign of the world, numbered after the highest one, with
 * its Nile years. It runs RUNNING when `startsAt` is already past at `now`.
 */
export async function createReign(
  tx: Prisma.TransactionClient,
  world: World,
  startsAt: Date,
  now: Date,
): Promise<Reign> {
  const highest = await tx.reign.aggregate({
    where: { worldId: world.id },
    _max: { number: true },
  });
  const endsAt = new Date(
    startsAt.getTime() +
      toRealMs(reignLengthHours(GAME_DATA.parameters), world.speed),
  );
  const reign = await tx.reign.create({
    data: {
      worldId: world.id,
      number: (highest._max.number ?? 0) + 1,
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
  return reign;
}
