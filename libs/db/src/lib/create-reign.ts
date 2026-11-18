import { GAME_DATA } from '@nomarque/data';
import { drawFloods, reignLengthHours, toRealMs } from '@nomarque/rules';
import type {
  FloodLevel as DbFloodLevel,
  Prisma,
  Reign,
  World,
} from './prisma';

const FLOOD_TO_DB = {
  low: 'LOW',
  good: 'GOOD',
  high: 'HIGH',
} as const satisfies Record<'low' | 'good' | 'high', DbFloodLevel>;

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
    data: drawFloods(reign.id, GAME_DATA).map((flood, index) => ({
      reignId: reign.id,
      index,
      floodLevel: FLOOD_TO_DB[flood],
      revealedAt: null,
    })),
  });
  return reign;
}
