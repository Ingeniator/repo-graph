import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { RawConfig } from './types.js';

export function loadConfig(configPath: string): RawConfig {
  const absolutePath = path.resolve(configPath);
  const configDir = path.dirname(absolutePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const parsed = YAML.parse(content) as RawConfig;

  if (!parsed?.repos?.length) {
    throw new Error(`No repos defined in config: ${absolutePath}`);
  }

  parsed.repos = parsed.repos.map((repo) => {
    if (!repo.path && !repo.github && !repo.git) {
      throw new Error(`Repo '${repo.name}' must define one of: path, github, git`);
    }

    return {
      ...repo,
      path: repo.path ? path.resolve(configDir, repo.path) : undefined,
    };
  });

  parsed.settings = {
    ...parsed.settings,
    cacheDir: path.resolve(configDir, parsed.settings?.cacheDir ?? '.cache/repos'),
  };

  return parsed;
}
