// Helpers shared by the importer tests: locate the workspace and read the real
// CSV sources without depending on the directory tests are launched from.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { SOURCE_FILES, type SourceBundle } from './build';

export function findWorkspaceRoot(): string {
  let directory = process.cwd();
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
        `could not find the workspace root from ${process.cwd()}`,
      );
    }
    directory = parent;
  }
}

export function readRealSources(): SourceBundle {
  const sourceDirectory = join(findWorkspaceRoot(), 'data', 'economie');
  return Object.fromEntries(
    SOURCE_FILES.map((file) => [
      file,
      readFileSync(join(sourceDirectory, file), 'utf8'),
    ]),
  ) as SourceBundle;
}
