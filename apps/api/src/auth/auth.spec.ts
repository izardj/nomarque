import request from 'supertest';
import type { App } from 'supertest/types';
import { SESSION_COOKIE } from './auth.constants';
import { hashSecret } from './tokens';
import {
  createTestApp,
  freshIp,
  hasDatabase,
  tokenFromMail,
  type TestApp,
} from '../../test/test-app';

describe.skipIf(!hasDatabase)('auth by magic link', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer() as App;
    await t.prisma.client.$executeRawUnsafe(
      'TRUNCATE "Player", "MagicLinkToken", "Session" CASCADE',
    );
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function requestLink(email: string): Promise<request.Response> {
    return request(server)
      .post('/api/auth/magic-link')
      .set('X-Forwarded-For', freshIp())
      .send({ email });
  }

  async function verify(token: string): Promise<request.Response> {
    return request(server)
      .post('/api/auth/verify')
      .set('X-Forwarded-For', freshIp())
      .send({ token });
  }

  async function login(email: string): Promise<string> {
    await requestLink(email);
    const mail = t.mailer.lastTo(email);
    const response = await verify(tokenFromMail(mail!));
    const cookie = ([] as string[]).concat(
      response.headers['set-cookie'] ?? [],
    )[0];
    return cookie!.split(';')[0]!;
  }

  it('rejects an invalid address', async () => {
    const response = await requestLink('not-an-email');
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('invalid_body');
  });

  it('sends a link without creating the account yet', async () => {
    const response = await requestLink('  Ramses@Example.org ');
    expect(response.status).toBe(202);
    expect(response.body).toEqual({ sent: true });
    const mail = t.mailer.lastTo('ramses@example.org');
    expect(mail?.text).toContain('http://localhost:4200/login/verify?token=');
    expect(
      await t.prisma.client.player.count({
        where: { email: 'ramses@example.org' },
      }),
    ).toBe(0);
  });

  it('stores only the hash of the link token', async () => {
    await requestLink('hash@example.org');
    const token = tokenFromMail(t.mailer.lastTo('hash@example.org')!);
    const stored = await t.prisma.client.magicLinkToken.findMany({
      where: { email: 'hash@example.org' },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]!.tokenHash).toBe(hashSecret(token));
    expect(stored[0]!.tokenHash).not.toContain(token);
  });

  it('opens a session with an httpOnly cookie and creates the player', async () => {
    await requestLink('nefertari@example.org');
    const token = tokenFromMail(t.mailer.lastTo('nefertari@example.org')!);
    const response = await verify(token);

    expect(response.status).toBe(200);
    expect(response.body.player.email).toBe('nefertari@example.org');
    expect(response.body.dynasty).toBeNull();
    const cookie = ([] as string[]).concat(
      response.headers['set-cookie'] ?? [],
    )[0]!;
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('accepts a link only once', async () => {
    await requestLink('once@example.org');
    const token = tokenFromMail(t.mailer.lastTo('once@example.org')!);
    expect((await verify(token)).status).toBe(200);
    const second = await verify(token);
    expect(second.status).toBe(401);
    expect(second.body.code).toBe('invalid_token');
  });

  it('refuses concurrent redemptions of the same link', async () => {
    await requestLink('race@example.org');
    const token = tokenFromMail(t.mailer.lastTo('race@example.org')!);
    const statuses = (
      await Promise.all([verify(token), verify(token), verify(token)])
    ).map((r) => r.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
  });

  it('refuses an expired link', async () => {
    await requestLink('late@example.org');
    const token = tokenFromMail(t.mailer.lastTo('late@example.org')!);
    await t.prisma.client.magicLinkToken.updateMany({
      where: { email: 'late@example.org' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await verify(token)).status).toBe(401);
  });

  it('refuses an unknown token', async () => {
    expect((await verify('x'.repeat(43))).status).toBe(401);
  });

  it('caps the number of links per address, with the same answer', async () => {
    const email = 'quota@example.org';
    for (let i = 0; i < 4; i += 1) {
      expect((await requestLink(email)).status).toBe(202);
    }
    expect(
      t.mailer.sent.filter((message) => message.to === email),
    ).toHaveLength(3);
  });

  it('reports a mail failure', async () => {
    t.mailer.failNext = true;
    const response = await requestLink('smtp@example.org');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('mail_unavailable');
  });

  it('serves /auth/me only with a live session, and logs out', async () => {
    expect((await request(server).get('/api/auth/me')).status).toBe(401);

    const cookie = await login('khaemwaset@example.org');
    const me = await request(server).get('/api/auth/me').set('Cookie', cookie);
    expect(me.status).toBe(200);
    expect(me.body.player.email).toBe('khaemwaset@example.org');

    expect(
      (await request(server).post('/api/auth/logout').set('Cookie', cookie))
        .status,
    ).toBe(204);
    expect(
      (await request(server).get('/api/auth/me').set('Cookie', cookie)).status,
    ).toBe(401);
  });

  it('refuses an expired session', async () => {
    const cookie = await login('expired-session@example.org');
    const player = await t.prisma.client.player.findUniqueOrThrow({
      where: { email: 'expired-session@example.org' },
    });
    await t.prisma.client.session.updateMany({
      where: { playerId: player.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await request(server).get('/api/auth/me').set('Cookie', cookie)).status,
    ).toBe(401);
  });

  it('rate-limits the link route per client address', async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await request(server)
        .post('/api/auth/magic-link')
        .set('X-Forwarded-For', ip)
        .send({ email: `flood${i}@example.org` });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 202)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
