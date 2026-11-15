import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/db',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'db',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one database: run files one after another.
    fileParallelism: false,
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/db',
      provider: 'v8' as const,
    },
  },
}));
