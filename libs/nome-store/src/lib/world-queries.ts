import type { PrismaClient, Reign, World } from '@nomarque/db';
import { z } from 'zod';

/** Reign statuses that make a reign "current", the highest number winning. */
const CURRENT_REIGN_STATUSES = ['SCHEDULED', 'RUNNING', 'FUNERALS'] as const;

/** Anything a query can run on: the client itself or a transaction. */
export type Db = Pick<PrismaClient, 'world' | 'reign' | 'dynasty' | 'nome'>;

const uuidSchema = z.guid();

/** Rows of the current reign, or null. */
export function findCurrentReign(
  db: Db,
  worldId: string,
): Promise<Reign | null> {
  return db.reign.findFirst({
    where: { worldId, status: { in: [...CURRENT_REIGN_STATUSES] } },
    orderBy: { number: 'desc' },
  });
}

/** The world, or null for an unknown id (a malformed id is unknown too). */
export async function findWorld(
  db: Db,
  worldId: string,
): Promise<World | null> {
  if (!uuidSchema.safeParse(worldId).success) {
    return null;
  }
  return db.world.findUnique({ where: { id: worldId } });
}
