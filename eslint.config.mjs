import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'type:rules',
              onlyDependOnLibsWithTags: ['type:data'],
            },
            {
              sourceTag: 'type:contracts',
              onlyDependOnLibsWithTags: ['type:data'],
            },
            {
              sourceTag: 'type:db',
              // The seed computes reign bounds with the game clock.
              onlyDependOnLibsWithTags: ['type:data', 'type:rules'],
            },
            {
              sourceTag: 'scope:tooling',
              onlyDependOnLibsWithTags: ['type:data'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'],
            },
            {
              sourceTag: 'scope:server',
              onlyDependOnLibsWithTags: ['scope:server', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      // Tests assert on values they just created.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
