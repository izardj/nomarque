import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  JoinWorldRequest,
  JoinWorldResponse,
  MyNomeResponse,
  WorldDto,
} from '@nomarque/contracts';
import { GAME_DATA } from '@nomarque/data';
import { Prisma, type Dynasty, type Reign } from '@nomarque/db';
import { foundNome } from '@nomarque/rules';
import { apiError } from '../common/api-error';
import { NomesRepository } from '../nomes/nomes.repository';
import { toJson } from '../nomes/nome-rows';
import { PrismaService } from '../prisma/prisma.service';
import { findCurrentReign, findWorld } from './world-queries';
import {
  clampedReignHours,
  regionFromDto,
  toNomeSummaryDto,
  toWorldDto,
} from './worlds.mapper';

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

@Injectable()
export class WorldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nomes: NomesRepository,
  ) {}

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
    const city = foundNome(GAME_DATA);
    const nome = await tx.nome.create({
      data: {
        reignId: reign.id,
        dynastyId: dynasty.id,
        name: body.nomeName,
        region,
        deben: city.deben,
        favor: 0,
        reputation: 0,
        computedAt: clampedReignHours(reign, world, now),
        rulesState: toJson(city.rules),
      },
    });
    await this.nomes.insertCity(tx, nome.id, city);
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
