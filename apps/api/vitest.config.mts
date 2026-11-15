import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/api',
  // SWC emits the decorator metadata NestJS relies on for injection.
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      tsconfigFile: false,
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    name: 'api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Integration tests share one database: run files one after another.
    fileParallelism: false,
    reporters: ['default'],
  },
}));
