import { Injectable } from '@nestjs/common';
import type { FloodLevel } from '@nomarque/data';
import {
  Prisma,
  type FloodLevel as DbFloodLevel,
  type Region,
} from '@nomarque/db';
import { GAME_DATA } from '@nomarque/data';
import {
  restoreRulesState,
  type AdvanceReport,
  type CardDealt,
  type NomeState,
  type ReignClock,
  type ResourceAmounts,
  type RulesState,
} from '@nomarque/rules';
import { findCurrentReign, findWorld } from './world-queries';
import {
  isResourceId,
  parcelColumns,
  parcelToRow,
  rowToParcel,
  toJson,
} from './nome-rows';

const FLOOD_FROM_DB: Record<DbFloodLevel, FloodLevel> = {
  LOW: 'low',
  GOOD: 'good',
  HIGH: 'high',
};

/** Who the nome is and the reign it plays in: what a request cannot change. */
export interface NomeContext {
  id: string;
  name: string;
  region: Region;
  dynastyName: string;
  dataVersion: string;
  clock: ReignClock;
  /** Flood of each Nile year of the reign, by zero-based year. */
  floods: FloodLevel[];
}

/** What changes with the actions of the player. */
export interface StoredNome {
  state: NomeState;
  /** Game hour up to which the state is computed. */
  computedAt: number;
  pendingReport: AdvanceReport | null;
}

/** A card whose choice applied, identified like its row of the history. */
export interface SettledCard {
  cardId: string;
  drawnAt: number;
  choice: string;
  resolvedAt: number;
}

type Tx = Prisma.TransactionClient;

@Injectable()
export class NomesRepository {
  /** The player's nome in the current reign of the world, or null. */
  async findCurrent(
    tx: Tx,
    playerId: string,
    worldId: string,
  ): Promise<NomeContext | null> {
    const world = await findWorld(tx, worldId);
    const reign = world && (await findCurrentReign(tx, world.id));
    if (!world || !reign) {
      return null;
    }
    const nome = await tx.nome.findFirst({
      where: { reignId: reign.id, dynasty: { playerId } },
      include: { dynasty: true },
    });
    if (!nome) {
      return null;
    }
    return {
      id: nome.id,
      name: nome.name,
      region: nome.region,
      dynastyName: nome.dynasty.name,
      dataVersion: reign.dataVersion,
      clock: { startsAtMs: reign.startsAt.getTime(), speed: world.speed },
      floods: await this.floods(tx, reign.id),
    };
  }

  /** Flood of each Nile year of the reign, by zero-based year. */
  async floods(tx: Tx, reignId: string): Promise<FloodLevel[]> {
    const years = await tx.nileYear.findMany({
      where: { reignId },
      orderBy: { index: 'asc' },
    });
    return years.map((year) => FLOOD_FROM_DB[year.floodLevel]);
  }

  /** Holds the nome row until the transaction ends: its actions queue up. */
  async lock(tx: Tx, nomeId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Nome" WHERE id = ${nomeId}::uuid FOR UPDATE`;
  }

  async load(tx: Tx, nomeId: string): Promise<StoredNome> {
    const nome = await tx.nome.findUniqueOrThrow({ where: { id: nomeId } });
    const parcels = await tx.parcel.findMany({
      where: { nomeId },
      orderBy: { slot: 'asc' },
    });
    const stocks = await tx.stock.findMany({ where: { nomeId } });
    const amounts: ResourceAmounts = {};
    for (const stock of stocks) {
      if (isResourceId(stock.resource)) {
        amounts[stock.resource] = stock.quantity;
      }
    }
    return {
      state: {
        deben: nome.deben,
        favor: nome.favor,
        stocks: amounts,
        parcels: parcels.map(rowToParcel),
        // Older rows hold `{}` or lack the fields added since.
        rules: restoreRulesState(
          nome.rulesState as Partial<RulesState> | null,
          GAME_DATA,
        ),
      },
      computedAt: nome.computedAt,
      pendingReport: nome.pendingReport
        ? (nome.pendingReport as unknown as AdvanceReport)
        : null,
    };
  }

  /** Writes what differs between `before` and `after`, and the new bookmark. */
  async save(
    tx: Tx,
    nomeId: string,
    before: NomeState,
    after: NomeState,
    computedAt: number,
    pendingReport: AdvanceReport | null,
  ): Promise<void> {
    await tx.nome.update({
      where: { id: nomeId },
      data: {
        deben: after.deben,
        favor: after.favor,
        rulesState: toJson(after.rules),
        computedAt,
        pendingReport: pendingReport ? toJson(pendingReport) : Prisma.DbNull,
      },
    });
    for (const parcel of after.parcels) {
      const old = before.parcels.find((p) => p.slot === parcel.slot);
      if (JSON.stringify(old) !== JSON.stringify(parcel)) {
        await tx.parcel.update({
          where: { nomeId_slot: { nomeId, slot: parcel.slot } },
          data: parcelColumns(parcel),
        });
      }
    }
    await this.saveStocks(tx, nomeId, before.stocks, after.stocks);
  }

  /** History of the cards dealt; a card already recorded is left alone. */
  async recordCardsDealt(
    tx: Tx,
    nomeId: string,
    dealt: readonly CardDealt[],
    graceHours: number,
  ): Promise<void> {
    for (const card of dealt) {
      const key = { nomeId, cardId: card.cardId, drawnAt: card.at };
      await tx.eventCardDraw.upsert({
        where: { nomeId_cardId_drawnAt: key },
        create: { ...key, expiresAt: card.at + graceHours },
        update: {},
      });
    }
  }

  /** Marks cards of the history as settled, by the player or by default. */
  async recordCardsSettled(
    tx: Tx,
    nomeId: string,
    settled: readonly SettledCard[],
  ): Promise<void> {
    for (const { cardId, drawnAt, choice, resolvedAt } of settled) {
      await tx.eventCardDraw.updateMany({
        where: { nomeId, cardId, drawnAt },
        data: { choice, resolvedAt },
      });
    }
  }

  /** Creates the parcels and stocks of a freshly founded nome. */
  async insertCity(tx: Tx, nomeId: string, state: NomeState): Promise<void> {
    await tx.parcel.createMany({
      data: state.parcels.map((parcel) => parcelToRow(nomeId, parcel)),
    });
    await tx.stock.createMany({
      data: Object.entries(state.stocks).map(([resource, quantity]) => ({
        nomeId,
        resource,
        quantity,
      })),
    });
  }

  private async saveStocks(
    tx: Tx,
    nomeId: string,
    before: ResourceAmounts,
    after: ResourceAmounts,
  ): Promise<void> {
    for (const [resource, quantity] of Object.entries(after)) {
      if (before[resource as keyof ResourceAmounts] !== quantity) {
        await tx.stock.upsert({
          where: { nomeId_resource: { nomeId, resource } },
          create: { nomeId, resource, quantity },
          update: { quantity },
        });
      }
    }
    const gone = Object.keys(before).filter((resource) => !(resource in after));
    if (gone.length > 0) {
      await tx.stock.deleteMany({ where: { nomeId, resource: { in: gone } } });
    }
  }
}
