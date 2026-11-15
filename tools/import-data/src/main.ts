// Entry point of `nx run tools:import-data` and `nx run tools:check-data`.
// Reads data/economie/*.csv, builds validated game data and writes the two
// generated files under libs/data. With --check it only compares them.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  GAME_DATA_PATH,
  FR_LABELS_PATH,
  SOURCE_FILES,
  buildGameData,
  renderGameDataFile,
  renderLabelsFile,
  type SourceBundle,
} from './build';

function findWorkspaceRoot(start: string): string {
  let directory = start;
  while (true) {
    if (
      existsSync(join(directory, 'data', 'economie')) &&
      existsSync(join(directory, 'pnpm-workspace.yaml'))
    ) {
      return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(
        `could not find the workspace root (data/economie) from ${start}`,
      );
    }
    directory = parent;
  }
}

function readSources(root: string): SourceBundle {
  const sourceDirectory = join(root, 'data', 'economie');
  const sources = Object.fromEntries(
    SOURCE_FILES.map((file) => [
      file,
      readFileSync(join(sourceDirectory, file), 'utf8'),
    ]),
  ) as SourceBundle;
  return sources;
}

async function main(): Promise<number> {
  const checkOnly = process.argv.includes('--check');
  const root = findWorkspaceRoot(process.cwd());
  const sources = readSources(root);
  const { data, labels } = buildGameData(sources);

  const gameDataPath = join(root, GAME_DATA_PATH);
  const labelsPath = join(root, FR_LABELS_PATH);
  const outputs: { path: string; relative: string; content: string }[] = [
    {
      path: gameDataPath,
      relative: GAME_DATA_PATH,
      content: await renderGameDataFile(data, gameDataPath),
    },
    {
      path: labelsPath,
      relative: FR_LABELS_PATH,
      content: await renderLabelsFile(labels, labelsPath),
    },
  ];

  if (checkOnly) {
    const stale = outputs.filter((output) => {
      const current = existsSync(output.path)
        ? readFileSync(output.path, 'utf8')
        : null;
      return current !== output.content;
    });
    if (stale.length > 0) {
      for (const output of stale) {
        console.error(`stale: ${output.relative}`);
      }
      console.error(
        'Generated game data does not match data/economie. Run `nx run tools:import-data`.',
      );
      return 1;
    }
    console.log('Generated game data matches data/economie.');
    return 0;
  }

  for (const output of outputs) {
    mkdirSync(dirname(output.path), { recursive: true });
    writeFileSync(output.path, output.content, 'utf8');
    console.log(`wrote ${output.relative}`);
  }
  console.log(`game data version ${data.version}`);

  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
