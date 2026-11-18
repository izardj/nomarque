import type { NomeStateResponse, PendingCardDto } from '@nomarque/contracts';
import {
  GAME_DATA,
  type BuildingDef,
  type CardChoiceKey,
  type MapSlotDef,
  type ResourceId,
} from '@nomarque/data';
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
const {
  startingDeben,
  houseBlockCost,
  houseZones,
  cardDrawIntervalHours,
  offeringIntervalHours,
} = GAME_DATA.parameters;
const REIGN_REAL_HOURS = 96;

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

/** A field of the starting map and another crop its zone allows. */
function swappableField(): { slot: MapSlotDef; crop: BuildingDef } {
  const fields = GAME_DATA.buildings.filter((b) => b.kind === 'field');
  for (const slot of startingBuildings) {
    const current =
      slot.start?.kind === 'building' ? slot.start.building : null;
    if (!fields.some((f) => f.id === current)) {
      continue;
    }
    const crop = fields.find(
      (f) => f.id !== current && f.zones.includes(slot.zone),
    );
    if (crop) {
      return { slot, crop };
    }
  }
  throw new Error('No field can change crop in the starting map.');
}

/** A god whose offering the starting stocks pay for. */
function affordableGod() {
  const god = GAME_DATA.gods.find(
    (g) =>
      (GAME_DATA.startingStocks[g.offering.resource] ?? 0) >=
      g.offering.quantity,
  );
  if (!god) {
    throw new Error('No god accepts an offering from the starting stocks.');
  }
  return god;
}

/** What a choice of a pending card certainly adds to a stock or the deben. */
function directChange(
  card: PendingCardDto,
  key: CardChoiceKey,
): { resource: ResourceId | 'deben'; amount: number } | undefined {
  const choice = GAME_DATA.cards
    .find((c) => c.id === card.cardId)
    ?.choices.find((c) => c.key === key);
  for (const effect of choice?.effects ?? []) {
    if (effect.kind === 'resource') {
      return { resource: effect.resource, amount: effect.amount };
    }
    if (effect.kind === 'deben') {
      return { resource: 'deben', amount: effect.amount };
    }
  }
  return undefined;
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
        endsAt: new Date(startsAt.getTime() + REIGN_REAL_HOURS * HOUR_MS),
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

  /**
   * Lets draw instants pass until a pending card satisfies `wanted`. Which
   * card comes depends on the nome id, so tests read it instead of fixing it.
   */
  async function waitForCard(
    p: Player,
    wanted: (card: PendingCardDto, state: NomeStateResponse) => boolean = () =>
      true,
  ): Promise<{ card: PendingCardDto; state: NomeStateResponse }> {
    for (let draws = 0; draws < 40; draws += 1) {
      wait(cardDrawIntervalHours / SPEED);
      const state = (await get(p)).body as NomeStateResponse;
      const card = state.nome.cards.find((c) => wanted(c, state));
      if (card) {
        return { card, state };
      }
    }
    throw new Error('No suitable card was dealt.');
  }

  const cardRows = (p: Player) =>
    t.prisma.client.eventCardDraw.findMany({
      where: { nomeId: p.nomeId },
      orderBy: { drawnAt: 'asc' },
    });

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
      request(server)
        .post(`${base}/parcels/0/crop`)
        .send({ crop: swappableField().crop.id }),
      request(server).post(`${base}/offerings`).send({ god: 'hapy' }),
      request(server).post(`${base}/cards/0/choice`).send({ choice: 'a' }),
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
    // Short enough for no card to reach its default choice, which would
    // change the deben: a card is dealt at 16 hours and settles 24 later.
    wait(2);
    const response = await get(p);
    expect(response.status).toBe(200);
    const { nome, report } = response.body as NomeStateResponse;
    expect(nome.gameHours).toBeCloseTo((JOINED_AFTER + 2) * SPEED, 6);
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
      [`parcels/${slot}/crop`, { crop: 'palace' }],
      ['offerings', { god: 'zeus' }],
      ['cards/0/choice', { choice: 'd' }],
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
      const card = await post(p, `cards/${bad}/choice`, { choice: 'a' });
      expect(card.status).toBe(400);
      expect(card.body.code).toBe('invalid_draw');
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

  describe('event cards', () => {
    it('deals a card, then applies the choice of the player', async () => {
      const p = await newPlayer('card');
      const { card, state } = await waitForCard(p, (c, st) =>
        c.choices.some((choice) => {
          const change = directChange(c, choice.key);
          return (
            choice.affordable &&
            change !== undefined &&
            (change.amount < 0 ||
              change.resource === 'deben' ||
              (st.nome.stocks[change.resource] ?? 0) + change.amount <=
                st.nome.capacity)
          );
        }),
      );
      expect(card.expiresAt).toBeCloseTo(
        card.drawnAt + GAME_DATA.parameters.cardGraceHours,
        6,
      );
      expect(state.report.cardsDealt.map((d) => d.drawId)).toContain(
        card.drawId,
      );
      const rows = await cardRows(p);
      const dealt = rows.find((r) => r.cardId === card.cardId);
      expect(dealt).toMatchObject({
        drawnAt: card.drawnAt,
        expiresAt: card.expiresAt,
        choice: null,
        resolvedAt: null,
      });

      const choice = card.choices.find(
        (c) => c.affordable && directChange(card, c.key) !== undefined,
      )!;
      const change = directChange(card, choice.key)!;
      const read = (r: NomeStateResponse): number =>
        change.resource === 'deben'
          ? r.nome.deben
          : (r.nome.stocks[change.resource] ?? 0);
      const response = await post(p, `cards/${card.drawId}/choice`, {
        choice: choice.key,
      });
      expect(response.status).toBe(201);
      const after = response.body as NomeStateResponse;
      expect(after.nome.cards.map((c) => c.drawId)).not.toContain(card.drawId);
      expect(read(after)).not.toBeCloseTo(read(state), 6);

      const settled = (await cardRows(p)).find((r) => r.cardId === card.cardId);
      expect(settled).toMatchObject({
        drawnAt: card.drawnAt,
        choice: choice.key,
        resolvedAt: after.nome.gameHours,
      });
      expect(
        (await cardRows(p)).filter((r) => r.cardId === card.cardId),
      ).toHaveLength(1);
      const logs = await t.prisma.client.actionLog.findMany({
        where: { nomeId: p.nomeId, type: 'nome.card' },
      });
      expect(logs.map((l) => l.payload)).toEqual([
        { drawId: card.drawId, choice: choice.key },
      ]);

      const again = await post(p, `cards/${card.drawId}/choice`, {
        choice: choice.key,
      });
      expect(again.status).toBe(422);
      expect(again.body.code).toBe('unknown_card');
    });

    it('applies the default choice of a card left alone, and records it', async () => {
      const p = await newPlayer('default');
      const { card } = await waitForCard(p);
      wait(GAME_DATA.parameters.cardGraceHours / SPEED + 0.1);
      const { nome, report } = (await get(p)).body as NomeStateResponse;
      expect(nome.cards.map((c) => c.drawId)).not.toContain(card.drawId);
      const defaulted = report.cardsDefaulted.find(
        (d) => d.drawId === card.drawId,
      );
      expect(defaulted).toMatchObject({
        cardId: card.cardId,
        choice: card.defaultChoice,
      });
      const row = (await cardRows(p)).find((r) => r.cardId === card.cardId);
      expect(row).toMatchObject({
        drawnAt: card.drawnAt,
        choice: card.defaultChoice,
        resolvedAt: card.expiresAt,
      });
    });

    it('records a card dealt and defaulted in one advance', async () => {
      const p = await newPlayer('oneshot');
      wait((8 * cardDrawIntervalHours) / SPEED);
      const { report } = (await get(p)).body as NomeStateResponse;
      expect(report.cardsDealt.length).toBeGreaterThan(0);
      const rows = await cardRows(p);
      expect(rows).toHaveLength(report.cardsDealt.length);
      for (const defaulted of report.cardsDefaulted) {
        expect(rows.find((r) => r.cardId === defaulted.cardId)?.choice).toBe(
          defaulted.choice,
        );
      }
    });
  });

  describe('offerings', () => {
    it('accepts an offering, then refuses a second one too soon', async () => {
      const p = await newPlayer('offering');
      const god = affordableGod();
      const before = (await get(p)).body as NomeStateResponse;
      expect(before.nome.nextOfferingAt).toBeNull();
      expect(before.nome.nextOfferingAtIso).toBeNull();

      const response = await post(p, 'offerings', { god: god.id });
      expect(response.status).toBe(201);
      const { nome } = response.body as NomeStateResponse;
      expect(nome.stocks[god.offering.resource]).toBeCloseTo(
        (before.nome.stocks[god.offering.resource] ?? 0) -
          god.offering.quantity,
        6,
      );
      expect(nome.gods[god.id].favor).toBeCloseTo(
        Math.min(
          GAME_DATA.parameters.godFavorMax,
          before.nome.gods[god.id].favor + god.favorPerOffering,
        ),
        6,
      );
      expect(nome.nextOfferingAt).toBeCloseTo(
        nome.gameHours + offeringIntervalHours,
        6,
      );
      expect(nome.nextOfferingAtIso).not.toBeNull();

      const second = await post(p, 'offerings', { god: god.id });
      expect(second.status).toBe(422);
      expect(second.body.code).toBe('offering_too_soon');
      expect(await logTypes(p)).toEqual(['world.join', 'nome.offering']);

      wait(offeringIntervalHours / SPEED + 0.1);
      const later = (await get(p)).body as NomeStateResponse;
      expect(later.nome.nextOfferingAt).toBeNull();
    });
  });

  describe('crops', () => {
    it('changes the crop of a field in Akhet, then locks it in Peret', async () => {
      const p = await newPlayer('crop');
      const { slot, crop } = swappableField();
      const first = (await get(p)).body as NomeStateResponse;
      expect(first.nome.nile.cropsLocked).toBe(false);

      const response = await post(p, `parcels/${slot.slot}/crop`, {
        crop: crop.id,
      });
      expect(response.status).toBe(201);
      const { nome } = response.body as NomeStateResponse;
      expect(nome.parcels[slot.slot]?.building).toBe(crop.id);
      const row = await t.prisma.client.parcel.findUniqueOrThrow({
        where: { nomeId_slot: { nomeId: p.nomeId, slot: slot.slot } },
      });
      expect(row.buildingType).toBe(crop.id);
      expect(row.workers).toBeLessThanOrEqual(crop.workers);

      const notAField = await post(p, `parcels/${emptySlots[0]!.slot}/crop`, {
        crop: crop.id,
      });
      expect(notAField.status).toBe(422);
      expect(notAField.body.code).toBe('not_a_field');

      // Peret starts at hour 48 of the Nile year.
      wait((48 - nome.gameHours) / SPEED + 0.1);
      const locked = await post(p, `parcels/${slot.slot}/crop`, {
        crop: crop.id,
      });
      expect(locked.status).toBe(422);
      expect(locked.body.code).toBe('crops_locked');
      const state = (await get(p)).body as NomeStateResponse;
      expect(state.nome.nile).toMatchObject({
        phase: 'peret',
        cropsLocked: true,
      });
    });
  });

  describe('end of the reign', () => {
    it('refuses every action once it is over, but still answers reads', async () => {
      const p = await newPlayer('over');
      wait(REIGN_REAL_HOURS);
      const state = await get(p);
      expect(state.status).toBe(200);
      const { nome } = state.body as NomeStateResponse;
      expect(nome.reign.over).toBe(true);
      expect(nome.gameHours).toBe(nome.reign.endsAt);
      expect(nome.reign.endsAt).toBe(4 * GAME_DATA.parameters.yearHours);
      expect(nome.nile.nextFlood).toBeNull();

      const actions = [
        buildHouses(p, houseSlots[0]!.slot),
        post(p, 'parcels/0/workers', { workers: 0 }),
        post(p, `parcels/${swappableField().slot.slot}/crop`, {
          crop: swappableField().crop.id,
        }),
        post(p, 'offerings', { god: affordableGod().id }),
        post(p, 'cards/0/choice', { choice: 'a' }),
      ];
      for (const response of await Promise.all(actions)) {
        expect(response.status).toBe(422);
        expect(response.body.code).toBe('reign_over');
      }
      expect(await logTypes(p)).toEqual(['world.join']);

      const acked = await post(p, 'report/ack');
      expect(acked.status).toBe(201);
      expect((await get(p)).status).toBe(200);
    });

    it('is not over before the last instant', async () => {
      const p = await newPlayer('almost');
      wait(REIGN_REAL_HOURS - JOINED_AFTER - 1);
      const { nome } = (await get(p)).body as NomeStateResponse;
      expect(nome.reign.over).toBe(false);
      expect((await buildHouses(p, houseSlots[0]!.slot)).status).toBe(201);
    });
  });

  describe('favour and legacy rows', () => {
    it('stores the favour of the pharaoh on the nome', async () => {
      const p = await newPlayer('favor');
      await t.prisma.client.nome.update({
        where: { id: p.nomeId },
        data: { favor: 10 },
      });
      // The tribute is levied at hour 166 of the first Nile year.
      wait((GAME_DATA.parameters.yearHours - JOINED_AFTER * SPEED) / SPEED);
      const { nome, report } = (await get(p)).body as NomeStateResponse;
      expect(report.royalFavor).not.toBe(0);
      expect(nome.favor).not.toBe(10);
      expect((await dbNome(p)).favor).toBeCloseTo(nome.favor, 6);
    });

    it.each([
      ['an empty document', {}],
      [
        'a document without the later fields',
        { houses: {}, cells: {}, peretOccupancy: {}, harvested: {} },
      ],
    ])(
      'loads and advances a row whose rules state is %s',
      async (_, legacy) => {
        const p = await newPlayer('legacy');
        await t.prisma.client.nome.update({
          where: { id: p.nomeId },
          data: { rulesState: legacy, favor: 0 },
        });
        wait(2);
        const response = await get(p);
        expect(response.status).toBe(200);
        const { nome } = response.body as NomeStateResponse;
        expect(nome.favor).toBe(0);
        expect(nome.cards).toBeInstanceOf(Array);
        expect(nome.gods.hapy.favor).toBeLessThan(
          GAME_DATA.parameters.godFavorStart,
        );
        expect((await dbNome(p)).rulesState).toHaveProperty('gods');
      },
    );
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
        post(player, 'offerings', { god: 'hapy' }),
        post(player, 'cards/0/choice', { choice: 'a' }),
        post(player, 'parcels/0/crop', { crop: swappableField().crop.id }),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(404);
        expect(response.body.code).toBe('nome_not_found');
      }
    }
  });
});
