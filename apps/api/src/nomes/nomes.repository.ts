import { Injectable } from '@nestjs/common';
import type { FloodLevel } from '@nomarque/data';
import {
  Prisma,
  type FloodLevel as DbFloodLevel,
  type Region,
} from '@nomarque/db';
import {
  emptyRulesState,
  type AdvanceReport,
  type NomeState,
  type ReignClock,
  type ResourceAmounts,
  type RulesState,
} from '@nomarque/rules';
import { z } from 'zod';
import { findCurrentReign, findWorld } from '../worlds/world-queries';
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
  favor: number;
  /** Game hour up to which the state is computed. */
  computedAt: number;
  pendingReport: AdvanceReport | null;
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
    const years = await tx.nileYear.findMany({
      where: { reignId: reign.id },
      orderBy: { index: 'asc' },
    });
    return {
      id: nome.id,
      name: nome.name,
      region: nome.region,
      dynastyName: nome.dynasty.name,
      dataVersion: reign.dataVersion,
      clock: { startsAtMs: reign.startsAt.getTime(), speed: world.speed },
      floods: years.map((year) => FLOOD_FROM_DB[year.floodLevel]),
    };
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
        stocks: amounts,
        parcels: parcels.map(rowToParcel),
        rules: rulesStateOf(nome.rulesState),
      },
      favor: nome.favor,
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

const emptyObjectSchema = z.object({}).strict();

/** `{}` is the column default of a nome that rules never touched. */
function rulesStateOf(json: Prisma.JsonValue): RulesState {
  if (emptyObjectSchema.safeParse(json).success) {
    return emptyRulesState();
  }
  return json as unknown as RulesState;
}
