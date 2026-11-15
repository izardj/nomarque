import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../node_modules/.vite/tools',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'tools',
    watch: false,
    passWithNoTests: true,
    globals: true,
    environment: 'node',
    include: [
      'import-data/src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../coverage/tools',
      provider: 'v8' as const,
    },
  },
}));
