import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { RawConfig, RepoConfig, RepoResolutionOptions, SourceDiagnostic } from './types.js';

export function resolveRepoSources(config: RawConfig, options: RepoResolutionOptions = {}): RawConfig {
  const cacheDir = path.resolve(options.cacheDir ?? config.settings?.cacheDir ?? '.cache/repos');
  const diagnostics = options.diagnostics ?? [];
  fs.mkdirSync(cacheDir, { recursive: true });

  return {
    ...config,
    settings: {
      ...config.settings,
      cacheDir,
    },
    repos: config.repos.map((repo) => resolveRepo(repo, cacheDir, { ...options, diagnostics })),
  };
}

function resolveRepo(repo: RepoConfig, cacheDir: string, options: RepoResolutionOptions): RepoConfig {
  if (repo.path) {
    return repo;
  }

  const remoteUrl = getRemoteUrl(repo);
  const repoCachePath = path.join(cacheDir, sanitizeRepoName(repo.name));
  const diagnostics = options.diagnostics ?? [];

  if (!fs.existsSync(repoCachePath)) {
    runGit(['clone', remoteUrl, repoCachePath], process.cwd(), repo, repoCachePath, diagnostics);
    diagnostics.push({
      repo: repo.name,
      source: remoteUrl,
      cachePath: repoCachePath,
      ref: repo.ref,
      severity: 'info',
      code: 'git.clone',
      message: 'Cloned repo into local cache',
    });
  } else if (options.refresh) {
    runGit(['fetch', '--all', '--tags', '--prune'], repoCachePath, repo, repoCachePath, diagnostics);
    diagnostics.push({
      repo: repo.name,
      source: remoteUrl,
      cachePath: repoCachePath,
      ref: repo.ref,
      severity: 'info',
      code: 'git.fetch',
      message: 'Refreshed cached repo from remote',
    });
  } else {
    diagnostics.push({
      repo: repo.name,
      source: remoteUrl,
      cachePath: repoCachePath,
      ref: repo.ref,
      severity: 'info',
      code: 'git.cache_hit',
      message: 'Using existing cached repo',
    });
  }

  checkoutRef(repoCachePath, repo, diagnostics);

  return {
    ...repo,
    path: repoCachePath,
  };
}

function checkoutRef(repoPath: string, repo: RepoConfig, diagnostics: SourceDiagnostic[]): void {
  const ref = repo.ref;
  if (!ref) {
    return;
  }

  const remoteBranchRef = `refs/remotes/origin/${ref}`;
  const remoteTagRef = `refs/tags/${ref}`;
  const localBranchRef = `refs/heads/${ref}`;

  if (gitRefExists(repoPath, remoteBranchRef)) {
    runGit(['checkout', '-B', ref, '--track', `origin/${ref}`], repoPath, repo, repoPath, diagnostics);
    diagnostics.push({
      repo: repo.name,
      source: getRemoteUrl(repo),
      cachePath: repoPath,
      ref,
      severity: 'info',
      code: 'git.checkout.branch',
      message: `Checked out remote branch origin/${ref}`,
    });
    return;
  }

  if (gitRefExists(repoPath, localBranchRef)) {
    runGit(['checkout', ref], repoPath, repo, repoPath, diagnostics);
    diagnostics.push({
      repo: repo.name,
      source: getRemoteUrl(repo),
      cachePath: repoPath,
      ref,
      severity: 'info',
      code: 'git.checkout.local_branch',
      message: `Checked out existing local branch ${ref}`,
    });
    return;
  }

  if (gitRefExists(repoPath, remoteTagRef)) {
    runGit(['checkout', '--detach', remoteTagRef], repoPath, repo, repoPath, diagnostics);
    diagnostics.push({
      repo: repo.name,
      source: getRemoteUrl(repo),
      cachePath: repoPath,
      ref,
      severity: 'info',
      code: 'git.checkout.tag',
      message: `Checked out tag ${ref}`,
    });
    return;
  }

  if (looksLikeCommitish(ref)) {
    runGit(['checkout', '--detach', ref], repoPath, repo, repoPath, diagnostics);
    diagnostics.push({
      repo: repo.name,
      source: getRemoteUrl(repo),
      cachePath: repoPath,
      ref,
      severity: 'info',
      code: 'git.checkout.commit',
      message: `Checked out commit ${ref}`,
    });
    return;
  }

  runGit(['checkout', ref], repoPath, repo, repoPath, diagnostics);
}

function gitRefExists(cwd: string, ref: string): boolean {
  try {
    execFileSync('git', ['show-ref', '--verify', '--quiet', ref], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function looksLikeCommitish(ref: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(ref);
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

function runGit(args: string[], cwd: string, repo: RepoConfig, repoCachePath: string, diagnostics: SourceDiagnostic[]): void {
  try {
    execFileSync('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error ? String((error as { stderr?: Buffer }).stderr ?? '') : '';
    const source = getRemoteUrl(repo);
    diagnostics.push({
      repo: repo.name,
      source,
      cachePath: repoCachePath,
      ref: repo.ref,
      severity: 'error',
      code: 'git.failed',
      message: `git ${args.join(' ')} failed`,
      details: enrichGitError(stderr, source),
    });
    throw new Error(`Failed to resolve repo '${repo.name}' from ${source}: ${enrichGitError(stderr, source)}`);
  }
}

function enrichGitError(stderr: string, source: string): string {
  const trimmed = stderr.trim();
  if (/repository .* not found/i.test(trimmed) || /could not read username/i.test(trimmed) || /authentication failed/i.test(trimmed)) {
    const githubHint = source.includes('github.com')
      ? ' Private GitHub repo? Prefer SSH (git@github.com:owner/repo.git) or ensure HTTPS auth/token access is configured for this host.'
      : '';
    return `${trimmed || 'authentication failed'}${githubHint}`.trim();
  }

  if (/permission denied \(publickey\)/i.test(trimmed)) {
    return `${trimmed} Ensure the current SSH key is allowed to access this repo.`;
  }

  return trimmed || 'git command failed';
}
