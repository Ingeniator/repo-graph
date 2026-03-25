import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RawConfig, RepoConfig, RepoResolutionOptions } from './types.js';

export function resolveRepoSources(config: RawConfig, options: RepoResolutionOptions = {}): RawConfig {
  const cacheDir = path.resolve(options.cacheDir ?? config.settings?.cacheDir ?? '.cache/repos');
  fs.mkdirSync(cacheDir, { recursive: true });

  return {
    ...config,
    settings: {
      ...config.settings,
      cacheDir,
    },
    repos: config.repos.map((repo) => resolveRepo(repo, cacheDir, options)),
  };
}

function resolveRepo(repo: RepoConfig, cacheDir: string, options: RepoResolutionOptions): RepoConfig {
  if (repo.path) {
    return repo;
  }

  const remoteUrl = getRemoteUrl(repo);
  const repoCachePath = path.join(cacheDir, sanitizeRepoName(repo.name));

  if (!fs.existsSync(repoCachePath)) {
    runGit(['clone', remoteUrl, repoCachePath], process.cwd());
  } else if (options.refresh) {
    runGit(['fetch', '--all', '--tags', '--prune'], repoCachePath);
  }

  checkoutRef(repoCachePath, repo.ref);

  return {
    ...repo,
    path: repoCachePath,
  };
}

function checkoutRef(repoPath: string, ref?: string): void {
  if (!ref) {
    return;
  }

  runGit(['checkout', ref], repoPath);
  runGit(['reset', '--hard', `origin/${ref}`], repoPath, true);
}

function getRemoteUrl(repo: RepoConfig): string {
  if (repo.git) {
    return repo.git;
  }

  if (repo.github) {
    if (repo.github.startsWith('http://') || repo.github.startsWith('https://') || repo.github.startsWith('git@')) {
      return repo.github;
    }
    return `https://github.com/${repo.github}.git`;
  }

  throw new Error(`Repo '${repo.name}' is missing a remote source`);
}

function sanitizeRepoName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, '-');
}

function runGit(args: string[], cwd: string, allowFailure = false): void {
  try {
    execFileSync('git', args, {
      cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
  } catch (error) {
    if (allowFailure) {
      return;
    }
    throw error;
  }
}
