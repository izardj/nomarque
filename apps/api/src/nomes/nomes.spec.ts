import type { NomeStateResponse } from '@nomarque/contracts';
import { GAME_DATA, type BuildingDef, type MapSlotDef } from '@nomarque/data';
import type { World } from '@nomarque/db';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createTestApp,
  freshIp,
  hasDatabase,
  login,
  type TestApp,
} from '../../test/test-app';

const HOUR_MS = 3_600_000;
const SPEED = 7;
/** Real hours the reign has been running when a nome joins. */
const JOINED_AFTER = 2;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const { startingDeben, houseBlockCost, houseZones } = GAME_DATA.parameters;

const emptySlots = GAME_DATA.map.filter((slot) => slot.start === null);
const houseSlots = emptySlots.filter((slot) => houseZones.includes(slot.zone));
const startingBuildings = GAME_DATA.map.filter(
  (slot) => slot.start?.kind === 'building',
);

/** A building the starting deben pays for, and an empty slot it may go on. */
function affordableBuilding(): { building: BuildingDef; slot: MapSlotDef } {
  for (const building of GAME_DATA.buildings) {
    const slot = emptySlots.find((s) => building.zones.includes(s.zone));
    if (slot && building.cost.deben <= startingDeben) {
      return { building, slot };
    }
  }
  throw new Error('No affordable building in the game data.');
}

/** A building that its zone forbids, on an empty slot. */
function forbiddenBuilding(): { building: BuildingDef; slot: MapSlotDef } {
  for (const building of GAME_DATA.buildings) {
    const slot = emptySlots.find((s) => !building.zones.includes(s.zone));
    if (slot) {
      return { building, slot };
    }
  }
  throw new Error('Every building fits every zone in the game data.');
}

function requiredWorkers(slot: MapSlotDef): number {
  const id = slot.start?.kind === 'building' ? slot.start.building : null;
  return GAME_DATA.buildings.find((b) => b.id === id)?.workers ?? 0;
}

describe.skipIf(!hasDatabase)('nomes', () => {
  let t: TestApp;
  let server: App;
  let worldCounter = 0;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer() as App;
    t.clock.freeze();
    await t.prisma.client.$executeRawUnsafe(
      'TRUNCATE "World", "Player", "MagicLinkToken", "Session", "Dynasty" CASCADE',
    );
  });

  afterAll(async () => {
    await t.app.close();
  });

  interface Player {
    cookie: string;
    /** Each player has an address of their own, for the rate limit. */
    ip: string;
    world: World;
    nomeId: string;
  }

  async function createWorld(): Promise<World> {
    worldCounter += 1;
    const world = await t.prisma.client.world.create({
      data: { name: `Nomes ${worldCounter}`, speed: SPEED },
    });
    const startsAt = new Date(t.clock.now() - JOINED_AFTER * HOUR_MS);
    const reign = await t.prisma.client.reign.create({
      data: {
        worldId: world.id,
        number: 1,
        status: 'RUNNING',
        dataVersion: GAME_DATA.version,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 96 * HOUR_MS),
      },
    });
    const floods = ['LOW', 'GOOD', 'HIGH', 'GOOD'] as const;
    await t.prisma.client.nileYear.createMany({
      data: floods.map((floodLevel, index) => ({
        reignId: reign.id,
        index,
        floodLevel,
      })),
    });
    return world;
  }

  /** A signed-in player who has joined a world of their own. */
  async function newPlayer(name: string): Promise<Player> {
    const cookie = await login(t, `${name}@example.org`);
    const ip = freshIp();
    const world = await createWorld();
    const joined = await request(server)
      .post(`/api/worlds/${world.id}/join`)
      .set('Cookie', cookie)
      .set('X-Forwarded-For', ip)
      .send({
        region: 'delta',
        dynastyName: 'Thoutmosides',
        nomeName: 'Bouto',
      });
    expect(joined.status).toBe(201);
    return { cookie, ip, world, nomeId: joined.body.nome.id };
  }

  function get(p: Player, path = 'state'): request.Test {
    return request(server)
      .get(`/api/worlds/${p.world.id}/nome/${path}`)
      .set('Cookie', p.cookie)
      .set('X-Forwarded-For', p.ip);
  }

  function post(p: Player, path: string, body?: object): request.Test {
    return request(server)
      .post(`/api/worlds/${p.world.id}/nome/${path}`)
      .set('Cookie', p.cookie)
      .set('X-Forwarded-For', p.ip)
      .send(body);
  }

  const buildHouses = (p: Player, slot: number): request.Test =>
    post(p, `parcels/${slot}/build`, { kind: 'houses' });

  /** Lets real hours pass: the nome is only computed when it is next asked. */
  function wait(realHours: number): void {
    t.clock.advance(realHours * HOUR_MS);
  }

  const dbNome = (p: Player) =>
    t.prisma.client.nome.findUniqueOrThrow({ where: { id: p.nomeId } });
  const logTypes = async (p: Player): Promise<string[]> =>
    (
      await t.prisma.client.actionLog.findMany({
        where: { nomeId: p.nomeId },
        orderBy: { createdAt: 'asc' },
      })
    ).map((entry) => entry.type);

  it('refuses every route without a session', async () => {
    const base = `/api/worlds/${UNKNOWN_ID}/nome`;
    const responses = await Promise.all([
      request(server).get(`${base}/state`),
      request(server).post(`${base}/parcels/0/build`).send({ kind: 'houses' }),
      request(server).post(`${base}/parcels/0/workers`).send({ workers: 1 }),
      request(server).post(`${base}/report/ack`),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('not_authenticated');
    }
  });

  it('founds the starting city when the player joins', async () => {
    const p = await newPlayer('founds');
    const nome = await t.prisma.client.nome.findUniqueOrThrow({
      where: { id: p.nomeId },
      include: { parcels: { orderBy: { slot: 'asc' } }, stocks: true },
    });
    expect(nome.parcels).toHaveLength(GAME_DATA.map.length);
    expect(nome.deben).toBe(startingDeben);
    expect(nome.parcels.map((parcel) => parcel.zone)).toEqual(
      GAME_DATA.map.map((slot) => slot.zone.toUpperCase()),
    );
    expect(
      Object.fromEntries(nome.stocks.map((s) => [s.resource, s.quantity])),
    ).toEqual(GAME_DATA.startingStocks);

    const response = await get(p);
    expect(response.status).toBe(200);
    const { nome: dto } = response.body as NomeStateResponse;
    expect(dto.parcels).toHaveLength(GAME_DATA.map.length);
    expect(dto.deben).toBe(startingDeben);
    expect(dto.dataVersion).toBe(GAME_DATA.version);
    expect(dto.nile).toMatchObject({ year: 0, phase: 'akhet', flood: 'low' });
    for (const slot of startingBuildings) {
      const parcel = dto.parcels[slot.slot];
      expect(parcel?.building).toBe(
        slot.start?.kind === 'building' ? slot.start.building : null,
      );
      expect(parcel?.workers).toBe(requiredWorkers(slot));
    }
  });

  it('advances the nome on read and reports what happened', async () => {
    const p = await newPlayer('reads');
    wait(4);
    const response = await get(p);
    expect(response.status).toBe(200);
    const { nome, report } = response.body as NomeStateResponse;
    expect(nome.gameHours).toBeCloseTo((JOINED_AFTER + 4) * SPEED, 6);
    expect(report.from).toBeCloseTo(JOINED_AFTER * SPEED, 6);
    expect(report.to).toBeCloseTo(nome.gameHours, 6);
    expect(report.consumed.wheat).toBeGreaterThan(0);
    expect(report.taxes).toBeGreaterThan(0);
    expect(nome.deben).toBeCloseTo(startingDeben + report.taxes, 6);
    expect(nome.stocks.wheat).toBeLessThan(GAME_DATA.startingStocks.wheat!);
    expect((await dbNome(p)).computedAt).toBeCloseTo(nome.gameHours, 6);
    expect(await logTypes(p)).toEqual(['world.join']);
  });

  it('keeps one report across several reads until it is acknowledged', async () => {
    const p = await newPlayer('ack');
    wait(1);
    const first = (await get(p)).body as NomeStateResponse;
    wait(1);
    const second = (await get(p)).body as NomeStateResponse;
    expect(second.report.from).toBeCloseTo(first.report.from, 6);
    expect(second.report.to).toBeGreaterThan(first.report.to);
    expect(second.report.taxes).toBeGreaterThan(first.report.taxes);
    expect(await dbNome(p).then((n) => n.pendingReport)).not.toBeNull();

    wait(1);
    const acked = await post(p, 'report/ack');
    expect(acked.status).toBe(201);
    const { nome, report } = acked.body as NomeStateResponse;
    expect(report.from).toBeCloseTo(nome.gameHours, 6);
    expect(report.to).toBeCloseTo(nome.gameHours, 6);
    expect(report.taxes).toBe(0);
    expect(report.consumed).toEqual({});
    expect(nome.deben).toBeGreaterThan(second.nome.deben);
    expect((await dbNome(p)).pendingReport).toBeNull();

    wait(1);
    const later = (await get(p)).body as NomeStateResponse;
    expect(later.report.from).toBeCloseTo(nome.gameHours, 6);
    expect(later.report.taxes).toBeGreaterThan(0);
  });

  it('builds a building: debits the cost and starts the construction', async () => {
    const p = await newPlayer('builds');
    const { building, slot } = affordableBuilding();
    const response = await post(p, `parcels/${slot.slot}/build`, {
      kind: 'building',
      building: building.id,
    });
    expect(response.status).toBe(201);
    const { nome } = response.body as NomeStateResponse;
    expect(nome.deben).toBe(startingDeben - building.cost.deben);
    const parcel = nome.parcels[slot.slot]!;
    expect(parcel.building).toBe(building.id);
    expect(parcel.buildEndsAt).toBeCloseTo(
      nome.gameHours + building.buildHours,
      6,
    );
    expect(parcel.buildEndsAtIso).not.toBeNull();

    const row = await t.prisma.client.parcel.findUniqueOrThrow({
      where: { nomeId_slot: { nomeId: p.nomeId, slot: slot.slot } },
    });
    expect(row.buildingType).toBe(building.id);
    expect(row.buildEndsAt).toBeCloseTo(parcel.buildEndsAt!, 6);
    expect((await dbNome(p)).deben).toBe(startingDeben - building.cost.deben);

    const logs = await t.prisma.client.actionLog.findMany({
      where: { nomeId: p.nomeId, type: 'nome.build' },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.payload).toEqual({
      slot: slot.slot,
      kind: 'building',
      building: building.id,
    });
  });

  it('builds a block of houses', async () => {
    const p = await newPlayer('houses');
    const slot = houseSlots[0]!;
    const response = await buildHouses(p, slot.slot);
    expect(response.status).toBe(201);
    const { nome } = response.body as NomeStateResponse;
    expect(nome.deben).toBe(startingDeben - houseBlockCost.deben);
    expect(nome.parcels[slot.slot]?.houses).toEqual({
      level: 1,
      count: GAME_DATA.parameters.housesPerBlock,
    });
  });

  it('delivers a construction once its duration has passed', async () => {
    const p = await newPlayer('delivers');
    await buildHouses(p, houseSlots[0]!.slot);
    wait(GAME_DATA.parameters.houseBlockBuildHours / SPEED + 0.1);
    const { nome, report } = (await get(p)).body as NomeStateResponse;
    expect(report.completed).toContain(houseSlots[0]!.slot);
    expect(nome.parcels[houseSlots[0]!.slot]?.buildEndsAt).toBeNull();
  });

  describe('refused actions', () => {
    /** Asserts the refusal and that the stored nome did not move at all. */
    async function expectRefused(
      p: Player,
      send: () => request.Test,
      code: string,
    ): Promise<void> {
      wait(1);
      const before = await dbNome(p);
      const logsBefore = await logTypes(p);
      const response = await send();
      expect(response.status).toBe(422);
      expect(response.body.code).toBe(code);
      expect(response.body.message).toEqual(expect.any(String));
      const after = await dbNome(p);
      expect(after.computedAt).toBe(before.computedAt);
      expect(after.deben).toBe(before.deben);
      expect(after.pendingReport).toEqual(before.pendingReport);
      expect(after.rulesState).toEqual(before.rulesState);
      expect(await logTypes(p)).toEqual(logsBefore);
    }

    it('refuses a building its zone forbids', async () => {
      const p = await newPlayer('zone');
      const { building, slot } = forbiddenBuilding();
      await expectRefused(
        p,
        () =>
          post(p, `parcels/${slot.slot}/build`, {
            kind: 'building',
            building: building.id,
          }),
        'zone_not_allowed',
      );
    });

    it('refuses a parcel that is not empty', async () => {
      const p = await newPlayer('occupied');
      const occupied = GAME_DATA.map.find((slot) => slot.start !== null)!;
      await expectRefused(
        p,
        () => buildHouses(p, occupied.slot),
        'parcel_not_empty',
      );
    });

    it('refuses a build the nome cannot pay', async () => {
      const p = await newPlayer('poor');
      await t.prisma.client.nome.update({
        where: { id: p.nomeId },
        data: { deben: houseBlockCost.deben - 1 },
      });
      // The taxes of the hour that passes must not cover the missing deben.
      await t.prisma.client.nome.update({
        where: { id: p.nomeId },
        data: { computedAt: (await dbNome(p)).computedAt },
      });
      const before = await dbNome(p);
      const response = await buildHouses(p, houseSlots[0]!.slot);
      expect(response.status).toBe(422);
      expect(response.body.code).toBe('not_enough_deben');
      expect((await dbNome(p)).deben).toBe(before.deben);
      expect(await logTypes(p)).toEqual(['world.join']);
    });

    it('refuses an unknown parcel', async () => {
      const p = await newPlayer('unknown');
      await expectRefused(
        p,
        () => buildHouses(p, GAME_DATA.map.length),
        'unknown_parcel',
      );
    });

    it('refuses more workers than the building requires', async () => {
      const p = await newPlayer('toomany');
      const slot = startingBuildings.find((s) => requiredWorkers(s) > 0)!;
      await expectRefused(
        p,
        () =>
          post(p, `parcels/${slot.slot}/workers`, {
            workers: requiredWorkers(slot) + 1,
          }),
        'invalid_workers',
      );
    });

    it('refuses workers on a parcel without a building', async () => {
      const p = await newPlayer('nobuilding');
      await expectRefused(
        p,
        () => post(p, `parcels/${emptySlots[0]!.slot}/workers`, { workers: 1 }),
        'no_building',
      );
    });
  });

  it('assigns workers to a building', async () => {
    const p = await newPlayer('workers');
    const slot = startingBuildings.find((s) => requiredWorkers(s) > 0)!;
    const workers = requiredWorkers(slot) - 1;
    const response = await post(p, `parcels/${slot.slot}/workers`, { workers });
    expect(response.status).toBe(201);
    const { nome } = response.body as NomeStateResponse;
    expect(nome.parcels[slot.slot]?.workers).toBe(workers);
    const row = await t.prisma.client.parcel.findUniqueOrThrow({
      where: { nomeId_slot: { nomeId: p.nomeId, slot: slot.slot } },
    });
    expect(row.workers).toBe(workers);
    expect(await logTypes(p)).toEqual(['world.join', 'nome.workers']);
  });

  it('rejects malformed bodies and slots', async () => {
    const p = await newPlayer('malformed');
    const slot = startingBuildings[0]!.slot;
    const bodies: [string, object][] = [
      [`parcels/${slot}/workers`, { workers: 1.5 }],
      [`parcels/${slot}/workers`, { workers: -1 }],
      [`parcels/${slot}/build`, { kind: 'palace' }],
      [`parcels/${slot}/build`, { kind: 'building', building: 'palace' }],
    ];
    for (const [path, body] of bodies) {
      const response = await post(p, path, body);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('invalid_body');
    }
    for (const bad of ['abc', '-1', '1.5']) {
      const response = await post(p, `parcels/${bad}/workers`, { workers: 1 });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('invalid_slot');
    }
  });

  it('serializes simultaneous actions on the same nome', async () => {
    const p = await newPlayer('race');
    const slots = houseSlots.slice(0, 3);
    expect(slots.length).toBeGreaterThan(1);
    const responses = await Promise.all(
      slots.map((slot) => buildHouses(p, slot.slot)),
    );
    expect(responses.map((r) => r.status)).toEqual(slots.map(() => 201));
    expect((await dbNome(p)).deben).toBe(
      startingDeben - slots.length * houseBlockCost.deben,
    );
    const state = (await get(p)).body as NomeStateResponse;
    expect(state.nome.deben).toBe(
      startingDeben - slots.length * houseBlockCost.deben,
    );
    expect(await logTypes(p)).toEqual([
      'world.join',
      ...slots.map(() => 'nome.build'),
    ]);
  });

  it('answers 404 when the player has no nome there', async () => {
    const p = await newPlayer('absent');
    const stranger = await login(t, 'stranger@example.org');
    const outsider = { ...p, cookie: stranger, ip: freshIp() };
    const empty = await t.prisma.client.world.create({
      data: { name: 'Nomes sans règne', speed: SPEED },
    });
    const cases: Player[] = [
      outsider,
      { ...p, world: empty },
      { ...p, world: { ...p.world, id: UNKNOWN_ID } },
      { ...p, world: { ...p.world, id: 'not-a-uuid' } },
    ];
    for (const player of cases) {
      const responses = await Promise.all([
        get(player),
        buildHouses(player, 0),
        post(player, 'parcels/0/workers', { workers: 0 }),
        post(player, 'report/ack'),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body.code).toBe('nome_not_found');
      }
    }
  });
});
