import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  JoinWorldRequest,
  JoinWorldResponse,
  MyNomeResponse,
  WorldDto,
} from '@nomarque/contracts';
import {
  Prisma,
  type Dynasty,
  type PrismaClient,
  type Reign,
  type World,
} from '@nomarque/db';
import { z } from 'zod';
import { apiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';
import {
  regionFromDto,
  reignGameHours,
  toNomeSummaryDto,
  toWorldDto,
} from './worlds.mapper';

/** Reign statuses that make a reign "current", the highest number winning. */
const CURRENT_REIGN_STATUSES = ['SCHEDULED', 'RUNNING', 'FUNERALS'] as const;

/** Anything a query can run on: the client itself or a transaction. */
type Db = Pick<PrismaClient, 'world' | 'reign' | 'dynasty' | 'nome'>;

const uuidSchema = z.guid();

function worldNotFound(): Error {
  return apiError(
    HttpStatus.NOT_FOUND,
    'world_not_found',
    "Ce monde n'existe pas.",
  );
}

function alreadyJoined(): Error {
  return apiError(
    HttpStatus.CONFLICT,
    'already_joined',
    'Tu as déjà un nome dans ce monde.',
  );
}

/** Rows of the current reign, or null. */
function findCurrentReign(db: Db, worldId: string): Promise<Reign | null> {
  return db.reign.findFirst({
    where: { worldId, status: { in: [...CURRENT_REIGN_STATUSES] } },
    orderBy: { number: 'desc' },
  });
}

/** The world, or null for an unknown id (a malformed id is unknown too). */
async function findWorld(db: Db, worldId: string): Promise<World | null> {
  if (!uuidSchema.safeParse(worldId).success) {
    return null;
  }
  return db.world.findUnique({ where: { id: worldId } });
}

@Injectable()
export class WorldsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Open worlds, sorted by name. */
  async listOpen(now: Date): Promise<WorldDto[]> {
    const worlds = await this.prisma.client.world.findMany({
      where: { status: 'OPEN' },
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      worlds.map(async (world) =>
        toWorldDto(
          world,
          await findCurrentReign(this.prisma.client, world.id),
          now,
        ),
      ),
    );
  }

  async get(worldId: string, now: Date): Promise<WorldDto> {
    const world = await findWorld(this.prisma.client, worldId);
    if (!world) {
      throw worldNotFound();
    }
    const reign = await findCurrentReign(this.prisma.client, world.id);
    return toWorldDto(world, reign, now);
  }

  /** Creates the player's dynasty if needed, then their nome for the current reign. */
  async join(
    playerId: string,
    worldId: string,
    body: JoinWorldRequest,
    now: Date,
  ): Promise<JoinWorldResponse> {
    try {
      return await this.prisma.client.$transaction((tx) =>
        this.joinInTransaction(tx, playerId, worldId, body, now),
      );
    } catch (error) {
      // Two simultaneous joins collide on a unique constraint: the loser
      // gets the same answer as a player who had already joined.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw alreadyJoined();
      }
      throw error;
    }
  }

  /** The player's nome in the current reign of the world, or null. */
  async myNome(playerId: string, worldId: string): Promise<MyNomeResponse> {
    const db = this.prisma.client;
    const world = await findWorld(db, worldId);
    if (!world) {
      throw worldNotFound();
    }
    const reign = await findCurrentReign(db, world.id);
    const dynasty = await db.dynasty.findUnique({ where: { playerId } });
    if (!reign || !dynasty) {
      return { nome: null };
    }
    const nome = await db.nome.findUnique({
      where: {
        reignId_dynastyId: { reignId: reign.id, dynastyId: dynasty.id },
      },
    });
    return { nome: nome ? toNomeSummaryDto(nome, dynasty.name) : null };
  }

  private async joinInTransaction(
    tx: Prisma.TransactionClient,
    playerId: string,
    worldId: string,
    body: JoinWorldRequest,
    now: Date,
  ): Promise<JoinWorldResponse> {
    const world = await findWorld(tx, worldId);
    if (!world || world.status !== 'OPEN') {
      throw worldNotFound();
    }
    const reign = await findCurrentReign(tx, world.id);
    if (!reign) {
      throw apiError(
        HttpStatus.CONFLICT,
        'no_active_reign',
        "Ce monde n'a pas de règne en cours.",
      );
    }
    if (reign.status === 'FUNERALS') {
      throw apiError(
        HttpStatus.CONFLICT,
        'reign_closing',
        'Le règne touche à sa fin. Attends le prochain.',
      );
    }

    const dynasty = await this.resolveDynasty(tx, playerId, reign, body);

    const region = regionFromDto(body.region);
    const nome = await tx.nome.create({
      data: {
        reignId: reign.id,
        dynastyId: dynasty.id,
        name: body.nomeName,
        region,
        // Starting values come from libs/data in J1.
        deben: 0,
        favor: 0,
        reputation: 0,
        computedAt: Math.max(0, reignGameHours(reign, world, now)),
        rulesState: {},
      },
    });
    await tx.actionLog.create({
      data: {
        nomeId: nome.id,
        type: 'world.join',
        payload: { region: body.region, nomeName: body.nomeName },
      },
    });
    return { nome: toNomeSummaryDto(nome, dynasty.name) };
  }

  /**
   * The player's dynasty, created from the request when they have none yet.
   * Refuses a player who already has a nome in the reign.
   */
  private async resolveDynasty(
    tx: Prisma.TransactionClient,
    playerId: string,
    reign: Reign,
    body: JoinWorldRequest,
  ): Promise<Dynasty> {
    const existing = await tx.dynasty.findUnique({ where: { playerId } });
    if (!existing) {
      if (!body.dynastyName) {
        throw apiError(
          HttpStatus.BAD_REQUEST,
          'dynasty_name_required',
          'Donne un nom à ta dynastie.',
        );
      }
      return tx.dynasty.create({ data: { playerId, name: body.dynastyName } });
    }
    const nome = await tx.nome.findUnique({
      where: {
        reignId_dynastyId: { reignId: reign.id, dynastyId: existing.id },
      },
      select: { id: true },
    });
    if (nome) {
      throw alreadyJoined();
    }
    return existing;
  }
}
