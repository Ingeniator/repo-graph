import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveRepoSources } from '../src/repo-sources.js';
import { RawConfig } from '../src/types.js';

function git(args: string[], cwd: string): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

test('resolveRepoSources clones git repos into cache and reuses cache', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-graph-test-'));
  const originPath = path.join(tempRoot, 'origin');
  const worktreePath = path.join(tempRoot, 'worktree');
  const cacheDir = path.join(tempRoot, 'cache');

  fs.mkdirSync(originPath, { recursive: true });
  git(['init', '--bare'], originPath);

  fs.mkdirSync(worktreePath, { recursive: true });
  git(['init', '-b', 'main'], worktreePath);
  git(['config', 'user.name', 'Test User'], worktreePath);
  git(['config', 'user.email', 'test@example.com'], worktreePath);
  fs.writeFileSync(path.join(worktreePath, 'Dockerfile'), 'FROM node:20-alpine\n');
  git(['add', 'Dockerfile'], worktreePath);
  git(['commit', '-m', 'init'], worktreePath);
  git(['remote', 'add', 'origin', originPath], worktreePath);
  git(['push', '-u', 'origin', 'main'], worktreePath);

  const config: RawConfig = {
    repos: [{ name: 'sample', git: originPath, ref: 'main' }],
    settings: { cacheDir },
  };

  const resolvedOnce = resolveRepoSources(config, { cacheDir });
  const clonedPath = resolvedOnce.repos[0].path;
  assert.ok(clonedPath);
  assert.equal(fs.existsSync(path.join(clonedPath!, 'Dockerfile')), true);

  const resolvedTwice = resolveRepoSources(config, { cacheDir });
  assert.equal(resolvedTwice.repos[0].path, clonedPath);
});
