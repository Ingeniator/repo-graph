import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { resolveRepoSources } from '../src/repo-sources.js';
import { RawConfig, SourceDiagnostic } from '../src/types.js';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function createOriginRepo(tempRoot: string) {
  const originPath = path.join(tempRoot, 'origin');
  const worktreePath = path.join(tempRoot, 'worktree');

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

  return { originPath, worktreePath };
}

test('resolveRepoSources clones git repos into cache and reuses cache', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-graph-test-'));
  const { originPath } = createOriginRepo(tempRoot);
  const cacheDir = path.join(tempRoot, 'cache');

  const config: RawConfig = {
    repos: [{ name: 'sample', git: originPath, ref: 'main' }],
    settings: { cacheDir },
  };

  const diagnostics: SourceDiagnostic[] = [];
  const resolvedOnce = resolveRepoSources(config, { cacheDir, diagnostics });
  const clonedPath = resolvedOnce.repos[0].path;
  assert.ok(clonedPath);
  assert.equal(fs.existsSync(path.join(clonedPath!, 'Dockerfile')), true);
  assert.equal(diagnostics.some((entry) => entry.code === 'git.clone'), true);
  assert.equal(diagnostics.some((entry) => entry.code === 'git.checkout.branch'), true);

  diagnostics.length = 0;
  const resolvedTwice = resolveRepoSources(config, { cacheDir, diagnostics });
  assert.equal(resolvedTwice.repos[0].path, clonedPath);
  assert.equal(diagnostics.some((entry) => entry.code === 'git.cache_hit'), true);
});

test('resolveRepoSources can check out tags and commits', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-graph-test-'));
  const { originPath, worktreePath } = createOriginRepo(tempRoot);
  const cacheDir = path.join(tempRoot, 'cache');

  git(['tag', 'v1.0.0'], worktreePath);
  git(['push', 'origin', 'v1.0.0'], worktreePath);
  const commitSha = git(['rev-parse', 'HEAD'], worktreePath);

  const tagConfig: RawConfig = {
    repos: [{ name: 'sample-tag', git: originPath, ref: 'v1.0.0' }],
    settings: { cacheDir },
  };
  const tagDiagnostics: SourceDiagnostic[] = [];
  const tagged = resolveRepoSources(tagConfig, { cacheDir, diagnostics: tagDiagnostics });
  assert.ok(tagged.repos[0].path);
  assert.equal(tagDiagnostics.some((entry) => entry.code === 'git.checkout.tag'), true);

  const commitConfig: RawConfig = {
    repos: [{ name: 'sample-commit', git: originPath, ref: commitSha }],
    settings: { cacheDir },
  };
  const commitDiagnostics: SourceDiagnostic[] = [];
  const committed = resolveRepoSources(commitConfig, { cacheDir, diagnostics: commitDiagnostics });
  assert.ok(committed.repos[0].path);
  assert.equal(commitDiagnostics.some((entry) => entry.code === 'git.checkout.commit'), true);
});

test('resolveRepoSources surfaces private GitHub guidance in auth-style failures', () => {
  const config: RawConfig = {
    repos: [{ name: 'private-repo', github: 'owner/private-repo' }],
  };

  assert.throws(
    () => resolveRepoSources(config, { cacheDir: path.join(os.tmpdir(), `repo-graph-missing-${Date.now()}`) }),
    /Private GitHub repo\? Prefer SSH \(git@github.com:owner\/repo.git\) or ensure HTTPS auth\/token access is configured for this host\./,
  );
});
