import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { configureApp } from '../src/app/configure-app';
import { CLOCK, type Clock } from '../src/common/clock';
import { Mailer, type MailMessage } from '../src/mail/mailer';
import { PrismaService } from '../src/prisma/prisma.service';

/** Captures e-mails instead of sending them. */
export class FakeMailer extends Mailer {
  readonly sent: MailMessage[] = [];
  failNext = false;

  async send(message: MailMessage): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('SMTP down');
    }
    this.sent.push(message);
  }

  lastTo(email: string): MailMessage | undefined {
    return [...this.sent].reverse().find((message) => message.to === email);
  }
}

/** Follows real time until frozen; then only moves when the test says so. */
export class TestClock implements Clock {
  private frozenAt: number | null = null;

  now(): number {
    return this.frozenAt ?? Date.now();
  }

  freeze(): void {
    this.frozenAt = Date.now();
  }

  /** Moves a frozen clock forward by real milliseconds. */
  advance(ms: number): void {
    // Whole milliseconds, like the dates the database stores.
    this.frozenAt = this.now() + Math.round(ms);
  }
}

export const hasDatabase = Boolean(process.env['DATABASE_URL']);

export interface TestApp {
  app: INestApplication;
  mailer: FakeMailer;
  clock: TestClock;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestApp> {
  process.env['APP_URL'] ??= 'http://localhost:4200';
  process.env['SMTP_HOST'] ??= 'localhost';
  process.env['SMTP_PORT'] ??= '1025';
  process.env['MAIL_FROM'] ??= 'Nomarque <test@nomarque.local>';

  const mailer = new FakeMailer();
  const clock = new TestClock();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Mailer)
    .useValue(mailer)
    .overrideProvider(CLOCK)
    .useValue(clock)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, mailer, clock, prisma: app.get(PrismaService) };
}

let ipCounter = 0;

/**
 * A distinct client address per call, so the per-IP rate limit of the auth
 * routes does not leak from one test to the next.
 */
export function freshIp(): string {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
}

/** Signs the e-mail in through the magic link and returns the session cookie. */
export async function login(t: TestApp, email: string): Promise<string> {
  const server = t.app.getHttpServer() as App;
  await request(server)
    .post('/api/auth/magic-link')
    .set('X-Forwarded-For', freshIp())
    .send({ email });
  const response = await request(server)
    .post('/api/auth/verify')
    .set('X-Forwarded-For', freshIp())
    .send({ token: tokenFromMail(t.mailer.lastTo(email)!) });
  const cookie = ([] as string[]).concat(
    response.headers['set-cookie'] ?? [],
  )[0];
  return cookie!.split(';')[0]!;
}

/** Extracts the token query parameter from the link inside a magic-link e-mail. */
export function tokenFromMail(message: MailMessage): string {
  const match = /https?:\/\/\S+/.exec(message.text);
  if (!match) {
    throw new Error('No link in e-mail');
  }
  const token = new URL(match[0]).searchParams.get('token');
  if (!token) {
    throw new Error('No token in link');
  }
  return token;
}
