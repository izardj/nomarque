import { defineConfig } from 'prisma/config';

// DATABASE_URL comes from the environment (.env at the repository root in
// development). It is only required by commands that reach the database
// (migrate, studio); `prisma generate` works without it.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL'] ?? '' },
});
