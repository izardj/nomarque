import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/** Applies migrations to the test database before integration tests run. */
export default function setup(): void {
  if (!process.env['DATABASE_URL']) {
    if (process.env['CI']) {
      throw new Error(
        'DATABASE_URL must be set in CI: integration tests cannot be skipped.',
      );
    }
    console.warn('DATABASE_URL is not set: integration tests will be skipped.');
    return;
  }
  execSync('pnpm prisma migrate deploy --config libs/db/prisma.config.ts', {
    cwd: resolve(import.meta.dirname, '../../..'),
    stdio: 'inherit',
  });
}
