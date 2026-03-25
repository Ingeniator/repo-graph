import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PATTERNS = ['Dockerfile', 'Dockerfile.'];

export function discoverDockerfiles(root: string, patterns: string[] = ['Dockerfile', 'Dockerfile.*']): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.cache') continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (matchesDockerfilePattern(entry.name, patterns)) {
        results.push(absolute);
      }
    }
  }

  if (!fs.existsSync(root)) {
    return [];
  }

  walk(root);
  return results.sort();
}

function matchesDockerfilePattern(name: string, patterns: string[]): boolean {
  if (!patterns.length) patterns = DEFAULT_PATTERNS;
  return patterns.some((pattern) => {
    if (pattern === 'Dockerfile') return name === 'Dockerfile';
    if (pattern === 'Dockerfile.*') return name === 'Dockerfile' || name.startsWith('Dockerfile.');
    return name === pattern;
  });
}
