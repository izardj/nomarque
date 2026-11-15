import type { Reign, ReignStatus, World } from '@nomarque/db';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createTestApp,
  freshIp,
  hasDatabase,
  tokenFromMail,
  type TestApp,
} from '../../test/test-app';

const HOUR_MS = 3_600_000;
const SPEED = 7;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describe.skipIf(!hasDatabase)('worlds', () => {
  let t: TestApp;
  let server: App;
  let worldCounter = 0;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer() as App;
    await t.prisma.client.$executeRawUnsafe(
      'TRUNCATE "World", "Player", "MagicLinkToken", "Session", "Dynasty" CASCADE',
    );
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function login(email: string): Promise<string> {
    await request(server)
      .post('/api/auth/magic-link')
      .set('X-Forwarded-For', freshIp())
      .send({ email });
    const mail = t.mailer.lastTo(email);
    const response = await request(server)
      .post('/api/auth/verify')
      .set('X-Forwarded-For', freshIp())
      .send({ token: tokenFromMail(mail!) });
    const cookie = ([] as string[]).concat(
      response.headers['set-cookie'] ?? [],
    )[0];
    return cookie!.split(';')[0]!;
  }

  interface WorldOptions {
    name?: string;
    status?: 'OPEN' | 'CLOSED';
    /** Real hours since the reign started; omit for a world without reign. */
    reignStartedHoursAgo?: number;
    reignStatus?: ReignStatus;
  }

  async function createWorld(
    options: WorldOptions = {},
  ): Promise<{ world: World; reign: Reign | null }> {
    worldCounter += 1;
    const world = await t.prisma.client.world.create({
      data: {
        name: options.name ?? `Monde ${worldCounter}`,
        speed: SPEED,
        status: options.status ?? 'OPEN',
      },
    });
    if (options.reignStartedHoursAgo === undefined) {
      return { world, reign: null };
    }
    const startsAt = new Date(
      Date.now() - options.reignStartedHoursAgo * HOUR_MS,
    );
    const reign = await t.prisma.client.reign.create({
      data: {
        worldId: world.id,
        number: 1,
        status: options.reignStatus ?? 'RUNNING',
        dataVersion: 'test',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 96 * HOUR_MS),
      },
    });
    return { world, reign };
  }

  const joinBody = {
    region: 'delta',
    dynastyName: 'Thoutmosides',
    nomeName: 'Bouto',
  };

  function join(
    cookie: string,
    worldId: string,
    body: unknown = joinBody,
  ): request.Test {
    return request(server)
      .post(`/api/worlds/${worldId}/join`)
      .set('Cookie', cookie)
      .send(body as object);
  }

  it('refuses every route without a session', async () => {
    const id = UNKNOWN_ID;
    const responses = await Promise.all([
      request(server).get('/api/worlds'),
      request(server).get(`/api/worlds/${id}`),
      request(server).post(`/api/worlds/${id}/join`).send(joinBody),
      request(server).get(`/api/worlds/${id}/nome`),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('not_authenticated');
    }
  });

  it('lists open worlds sorted by name', async () => {
    const cookie = await login('list@example.org');
    await createWorld({ name: 'Zeta list', reignStartedHoursAgo: 1 });
    await createWorld({ name: 'Alpha list' });
    await createWorld({ name: 'Closed list', status: 'CLOSED' });

    const response = await request(server)
      .get('/api/worlds')
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    const names = (response.body as { name: string }[]).map((w) => w.name);
    expect(names).not.toContain('Closed list');
    expect(names.indexOf('Alpha list')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('Alpha list')).toBeLessThan(
      names.indexOf('Zeta list'),
    );
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const alpha = (response.body as { name: string; reign: unknown }[]).find(
      (w) => w.name === 'Alpha list',
    );
    expect(alpha?.reign).toBeNull();
  });

  it('reads a world with the elapsed game hours', async () => {
    const cookie = await login('read@example.org');
    const { world, reign } = await createWorld({ reignStartedHoursAgo: 2 });

    const response = await request(server)
      .get(`/api/worlds/${world.id}`)
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: world.id,
      name: world.name,
      speed: SPEED,
      status: 'open',
      reign: {
        id: reign?.id,
        number: 1,
        status: 'running',
        monumentProgress: 0,
      },
    });
    expect(response.body.reign.gameHours).toBeGreaterThan(13.9);
    expect(response.body.reign.gameHours).toBeLessThan(14.5);
    expect(response.body.reign.startsAt).toBe(reign?.startsAt.toISOString());
  });

  it('takes the highest-numbered unfinished reign as the current one', async () => {
    const cookie = await login('current@example.org');
    const { world } = await createWorld({
      reignStartedHoursAgo: 500,
      reignStatus: 'ENDED',
    });
    const startsAt = new Date(Date.now() + HOUR_MS);
    const next = await t.prisma.client.reign.create({
      data: {
        worldId: world.id,
        number: 2,
        status: 'SCHEDULED',
        dataVersion: 'test',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 96 * HOUR_MS),
      },
    });

    const response = await request(server)
      .get(`/api/worlds/${world.id}`)
      .set('Cookie', cookie);
    expect(response.body.reign.id).toBe(next.id);
    expect(response.body.reign.status).toBe('scheduled');
    expect(response.body.reign.gameHours).toBeLessThan(0);
  });

  it('answers 404 for an unknown or malformed world id', async () => {
    const cookie = await login('missing@example.org');
    for (const id of [UNKNOWN_ID, 'not-a-uuid']) {
      const response = await request(server)
        .get(`/api/worlds/${id}`)
        .set('Cookie', cookie);
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('world_not_found');
      expect((await join(cookie, id)).status).toBe(404);
      expect(
        (
          await request(server)
            .get(`/api/worlds/${id}/nome`)
            .set('Cookie', cookie)
        ).status,
      ).toBe(404);
    }
  });

  it('joins a world: creates the dynasty, the nome and the action log', async () => {
    const cookie = await login('join@example.org');
    const { world, reign } = await createWorld({ reignStartedHoursAgo: 2 });

    const response = await join(cookie, world.id);
    expect(response.status).toBe(201);
    expect(response.body.nome).toMatchObject({
      reignId: reign?.id,
      name: 'Bouto',
      region: 'delta',
      dynastyName: 'Thoutmosides',
      deben: 0,
      favor: 0,
    });

    const player = await t.prisma.client.player.findUniqueOrThrow({
      where: { email: 'join@example.org' },
      include: { dynasty: true },
    });
    expect(player.dynasty?.name).toBe('Thoutmosides');
    const nome = await t.prisma.client.nome.findUniqueOrThrow({
      where: { id: response.body.nome.id },
      include: { actionLogs: true, parcels: true },
    });
    expect(nome.region).toBe('DELTA');
    expect(nome.reputation).toBe(0);
    expect(nome.rulesState).toEqual({});
    expect(nome.parcels).toHaveLength(0);
    expect(nome.computedAt).toBeGreaterThan(13.9);
    expect(nome.computedAt).toBeLessThan(14.5);
    expect(nome.actionLogs).toHaveLength(1);
    expect(nome.actionLogs[0]?.type).toBe('world.join');
    expect(nome.actionLogs[0]?.payload).toEqual({
      region: 'delta',
      nomeName: 'Bouto',
    });
  });

  it('starts a nome at game hour 0 when the reign is scheduled', async () => {
    const cookie = await login('scheduled@example.org');
    const { world } = await createWorld({
      reignStartedHoursAgo: -3,
      reignStatus: 'SCHEDULED',
    });
    const response = await join(cookie, world.id);
    expect(response.status).toBe(201);
    const nome = await t.prisma.client.nome.findUniqueOrThrow({
      where: { id: response.body.nome.id },
    });
    expect(nome.computedAt).toBe(0);
  });

  it('requires a dynasty name from a player without dynasty', async () => {
    const cookie = await login('nodynasty@example.org');
    const { world } = await createWorld({ reignStartedHoursAgo: 1 });
    const response = await join(cookie, world.id, {
      region: 'delta',
      nomeName: 'Bouto',
    });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('dynasty_name_required');
    const player = await t.prisma.client.player.findUniqueOrThrow({
      where: { email: 'nodynasty@example.org' },
      include: { dynasty: true },
    });
    expect(player.dynasty).toBeNull();
  });

  it('ignores the dynasty name of a player who already has a dynasty', async () => {
    const cookie = await login('twoworlds@example.org');
    const first = await createWorld({ reignStartedHoursAgo: 1 });
    const second = await createWorld({ reignStartedHoursAgo: 1 });
    expect((await join(cookie, first.world.id)).status).toBe(201);

    const response = await join(cookie, second.world.id, {
      region: 'upper_egypt',
      dynastyName: 'Autre nom',
      nomeName: 'Nekhen',
    });
    expect(response.status).toBe(201);
    expect(response.body.nome.dynastyName).toBe('Thoutmosides');
    expect(
      await t.prisma.client.dynasty.count({
        where: { player: { email: 'twoworlds@example.org' } },
      }),
    ).toBe(1);
  });

  it('refuses a second nome in the same reign', async () => {
    const cookie = await login('twice@example.org');
    const { world } = await createWorld({ reignStartedHoursAgo: 1 });
    expect((await join(cookie, world.id)).status).toBe(201);

    const response = await join(cookie, world.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('already_joined');
  });

  it('lets exactly one of two simultaneous joins through', async () => {
    const cookie = await login('race@example.org');
    const { world } = await createWorld({ reignStartedHoursAgo: 1 });

    const responses = await Promise.all([
      join(cookie, world.id),
      join(cookie, world.id),
    ]);
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(1);
    const loser = responses.find((r) => r.status === 409);
    expect(loser?.body.code).toBe('already_joined');
    expect(
      await t.prisma.client.nome.count({
        where: { reign: { worldId: world.id } },
      }),
    ).toBe(1);
  });

  it('refuses a join when no reign is current', async () => {
    const cookie = await login('noreign@example.org');
    const withoutReign = await createWorld();
    const ended = await createWorld({
      reignStartedHoursAgo: 500,
      reignStatus: 'ENDED',
    });
    for (const { world } of [withoutReign, ended]) {
      const response = await join(cookie, world.id);
      expect(response.status).toBe(409);
      expect(response.body.code).toBe('no_active_reign');
    }
  });

  it('refuses a join while the reign is in its funerals', async () => {
    const cookie = await login('funerals@example.org');
    const { world } = await createWorld({
      reignStartedHoursAgo: 90,
      reignStatus: 'FUNERALS',
    });
    const response = await join(cookie, world.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('reign_closing');
  });

  it('refuses a join in a closed world', async () => {
    const cookie = await login('closed@example.org');
    const { world } = await createWorld({
      status: 'CLOSED',
      reignStartedHoursAgo: 1,
    });
    const response = await join(cookie, world.id);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('world_not_found');
  });

  it('rejects an invalid join body', async () => {
    const cookie = await login('invalid@example.org');
    const { world } = await createWorld({ reignStartedHoursAgo: 1 });
    const bodies = [
      {},
      { region: 'atlantis', dynastyName: 'Thoutmosides', nomeName: 'Bouto' },
      { region: 'delta', dynastyName: 'Thoutmosides', nomeName: 'B' },
      { region: 'delta', dynastyName: 'T', nomeName: 'Bouto' },
    ];
    for (const body of bodies) {
      const response = await join(cookie, world.id, body);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('invalid_body');
    }
  });

  it("reads the player's nome before and after joining", async () => {
    const cookie = await login('mynome@example.org');
    const { world } = await createWorld({ reignStartedHoursAgo: 1 });
    const read = (): request.Test =>
      request(server).get(`/api/worlds/${world.id}/nome`).set('Cookie', cookie);

    const before = await read();
    expect(before.status).toBe(200);
    expect(before.body).toEqual({ nome: null });

    const joined = await join(cookie, world.id);
    const after = await read();
    expect(after.status).toBe(200);
    expect(after.body).toEqual({ nome: joined.body.nome });
  });
});
