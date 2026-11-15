import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

export const GLOBAL_PREFIX = 'api';

/** HTTP settings shared by main.ts and the integration tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.use(cookieParser());
  // One reverse proxy (nginx) in front of the API: trust its X-Forwarded-For.
  (app as NestExpressApplication).set('trust proxy', 1);
}
