import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // libs/rules is pure: it receives a state and an instant and returns a new
    // state. No clock, no randomness outside the seeded generator, no I/O.
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'Date',
          message:
            'libs/rules must not read the clock: take the instant as a parameter.',
        },
        { name: 'fetch', message: 'libs/rules must not do I/O.' },
        {
          name: 'process',
          message: 'libs/rules must not read the environment.',
        },
        { name: 'setTimeout', message: 'libs/rules must not schedule work.' },
        { name: 'setInterval', message: 'libs/rules must not schedule work.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded generator from libs/rules.',
        },
        {
          object: 'performance',
          property: 'now',
          message: 'libs/rules must not read the clock.',
        },
      ],
    },
  },
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: [
            '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
            '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
          ],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
