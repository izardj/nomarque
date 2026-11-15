import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app/app.module';
import { configureApp } from '../src/app/configure-app';
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

export const hasDatabase = Boolean(process.env['DATABASE_URL']);

export interface TestApp {
  app: INestApplication;
  mailer: FakeMailer;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestApp> {
  process.env['APP_URL'] ??= 'http://localhost:4200';
  process.env['SMTP_HOST'] ??= 'localhost';
  process.env['SMTP_PORT'] ??= '1025';
  process.env['MAIL_FROM'] ??= 'Nomarque <test@nomarque.local>';

  const mailer = new FakeMailer();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(Mailer)
    .useValue(mailer)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, mailer, prisma: app.get(PrismaService) };
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
