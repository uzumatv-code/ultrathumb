import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

function getCandidateDirectories(start: string): string[] {
  const directories: string[] = [];
  let current = start;

  while (true) {
    directories.push(current);
    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return directories;
}

function loadEnv(): void {
  if (process.env['THUMBFORGE_ENV_LOADED'] === 'true') {
    return;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const visited = new Set<string>();
  const candidates = [...getCandidateDirectories(process.cwd()), ...getCandidateDirectories(moduleDir)];

  for (const directory of candidates) {
    if (visited.has(directory)) {
      continue;
    }

    visited.add(directory);

    const envPath = join(directory, '.env');
    if (!existsSync(envPath)) {
      continue;
    }

    config({ path: envPath, override: false });
    process.env['THUMBFORGE_ENV_LOADED'] = 'true';
    process.env['THUMBFORGE_ENV_PATH'] = envPath;
    return;
  }
}

loadEnv();
