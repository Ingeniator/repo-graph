import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { RawConfig } from './types.js';

export function loadConfig(configPath: string): RawConfig {
  const absolutePath = path.resolve(configPath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const parsed = YAML.parse(content) as RawConfig;

  if (!parsed?.repos?.length) {
    throw new Error(`No repos defined in config: ${absolutePath}`);
  }

  parsed.repos = parsed.repos.map((repo) => ({
    ...repo,
    path: path.resolve(path.dirname(absolutePath), repo.path),
  }));

  return parsed;
}
