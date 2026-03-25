import path from 'node:path';
import { RawConfig, ScanGraph, RepoNode, GraphEdge, OwnershipResolution, SourceDiagnostic } from './types.js';
import { discoverDockerfiles } from './fs-utils.js';
import { parseDockerfile } from './dockerfile-parser.js';

interface OwnershipCandidate {
  repo: string;
  dockerfile?: string;
  confidence: 'configured' | 'inferred';
  reason: string;
}

export function buildGraph(config: RawConfig): ScanGraph {
  const sourceDiagnostics: SourceDiagnostic[] = [];
  const repos: RepoNode[] = config.repos.map((repo) => {
    if (!repo.path) {
      throw new Error(`Repo '${repo.name}' has no resolved path. Run source resolution before buildGraph.`);
    }

    return {
      name: repo.name,
      path: repo.path,
      dockerfiles: discoverDockerfiles(repo.path, config.settings?.dockerfilePatterns).map((dockerfilePath) =>
        parseDockerfile(repo, dockerfilePath),
      ),
    };
  });

  const edges: GraphEdge[] = [];
  const unresolvedImages = new Set<string>();
  let internalEdgeCount = 0;
  let externalEdgeCount = 0;
  let warningCount = repos.reduce((total, repo) => total + repo.dockerfiles.reduce((sum, dockerfile) => sum + dockerfile.warnings.length, 0), 0);

  for (const repo of repos) {
    for (const dockerfile of repo.dockerfiles) {
      for (const dependency of dockerfile.dependencies) {
        const ownership = resolveOwnership(config, repos, dependency.resolved);
        dependency.ownership = ownership;
        dependency.confidence = ownership.confidence;

        if (ownership.confidence === 'unresolved') {
          unresolvedImages.add(dependency.resolved);
          if (!dependency.warnings?.some((warning) => warning.code === 'ownership.unresolved')) {
            dependency.warnings = [
              ...(dependency.warnings ?? []),
              {
                code: 'ownership.unresolved',
                message: ownership.reason,
                line: dependency.sourceLine,
                instruction: dependency.sourceInstruction,
              },
            ];
            warningCount += 1;
          }
        }

        const targetScope = ownership.repo ? 'internal' : 'external';
        if (targetScope === 'internal') {
          internalEdgeCount += 1;
        } else {
          externalEdgeCount += 1;
        }

        edges.push({
          from: dockerfile.id,
          to: ownership.repo ?? dependency.resolved,
          kind: 'depends_on',
          confidence: ownership.confidence,
          metadata: {
            dependency: dependency.resolved,
            rawDependency: dependency.raw,
            sourceInstruction: dependency.sourceInstruction,
            sourceLine: String(dependency.sourceLine),
            warningCount: dependency.warnings?.length ? String(dependency.warnings.length) : undefined,
            repo: ownership.repo,
            dockerfile: ownership.dockerfile,
            reason: ownership.reason,
            targetScope,
          },
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    repos,
    edges,
    unresolvedImages: [...unresolvedImages].sort(),
    metadata: {
      repoCount: repos.length,
      dockerfileCount: repos.reduce((total, repo) => total + repo.dockerfiles.length, 0),
      dependencyCount: edges.length,
      internalEdgeCount,
      externalEdgeCount,
      unresolvedCount: unresolvedImages.size,
      warningCount,
      dockerfilePatterns: config.settings?.dockerfilePatterns ?? [],
      sourceDiagnostics,
    },
  };
}

function resolveOwnership(config: RawConfig, repos: RepoNode[], image: string): OwnershipResolution {
  const configured = resolveConfiguredOwnership(config, image);
  if (configured) {
    return configured;
  }

  const inferred = inferOwnership(repos, image);
  if (inferred) {
    return inferred;
  }

  return {
    confidence: 'unresolved',
    reason: image.includes('${') || image.includes('$') ? 'contains unresolved ARG substitution' : 'no configured or inferred owner found',
  };
}

function resolveConfiguredOwnership(config: RawConfig, image: string): OwnershipResolution | undefined {
  const entries = Object.entries(config.imageOwnership ?? {});
  const normalizedImage = normalizeImageReference(image);

  for (const [configuredImage, configured] of entries) {
    if (configuredImage === image || normalizeImageReference(configuredImage) === normalizedImage) {
      return {
        repo: configured.repo,
        dockerfile: configured.dockerfile,
        confidence: configured.confidence ?? 'configured',
        reason: configuredImage === image ? 'matched via imageOwnership config' : 'matched via normalized imageOwnership config',
      };
    }
  }

  return undefined;
}

function inferOwnership(repos: RepoNode[], image: string): OwnershipResolution | undefined {
  const exactMatches: OwnershipCandidate[] = [];
  const normalizedMatches: OwnershipCandidate[] = [];
  const heuristicMatches: OwnershipCandidate[] = [];
  const normalizedImage = normalizeImageReference(image);

  for (const repo of repos) {
    for (const dockerfile of repo.dockerfiles) {
      for (const declaredImage of dockerfile.declaredImages) {
        const candidate: OwnershipCandidate = {
          repo: repo.name,
          dockerfile: dockerfile.path,
          confidence: 'inferred',
          reason: 'matched configured image declaration on a discovered dockerfile',
        };

        if (declaredImage === image) {
          exactMatches.push(candidate);
        } else if (normalizeImageReference(declaredImage) === normalizedImage) {
          normalizedMatches.push({
            ...candidate,
            reason: 'matched normalized configured image declaration on a discovered dockerfile',
          });
        }
      }

      if (dockerfile.declaredImages.length === 0 && matchesImplicitOwner(repo.name, dockerfile.path, image)) {
        heuristicMatches.push({
          repo: repo.name,
          dockerfile: dockerfile.path,
          confidence: 'inferred',
          reason: 'matched repo/service heuristics for a dockerfile without declared produced images',
        });
      }
    }
  }

  const exact = collapseOwnershipMatches(exactMatches, image);
  if (exact) return exact;

  const normalized = collapseOwnershipMatches(normalizedMatches, image);
  if (normalized) return normalized;

  const heuristic = collapseOwnershipMatches(heuristicMatches, image);
  if (heuristic) return heuristic;

  const fallbackRepo = inferRepoNameFromImage(image, repos.map((repo) => repo.name));
  if (fallbackRepo) {
    return {
      repo: fallbackRepo,
      confidence: 'inferred',
      reason: 'matched repo name heuristically from image reference',
    };
  }

  return undefined;
}

function collapseOwnershipMatches(matches: OwnershipCandidate[], image: string): OwnershipResolution | undefined {
  if (!matches.length) return undefined;
  if (matches.length === 1) {
    return matches[0];
  }

  const uniqueTargets = new Set(matches.map((match) => `${match.repo}:${match.dockerfile ?? ''}`));
  if (uniqueTargets.size === 1) {
    return matches[0];
  }

  return {
    confidence: 'unresolved',
    reason: `multiple possible internal owners found for ${image}: ${matches.map(formatOwnershipCandidate).sort().join(', ')}`,
  };
}

function formatOwnershipCandidate(candidate: OwnershipCandidate): string {
  return candidate.dockerfile ? `${candidate.repo}/${candidate.dockerfile}` : candidate.repo;
}

function matchesImplicitOwner(repoName: string, dockerfilePath: string, image: string): boolean {
  const candidates = new Set<string>([
    repoName,
    path.posix.basename(repoName),
    deriveServiceKey(dockerfilePath),
    `${repoName}/${deriveServiceKey(dockerfilePath)}`,
    `${repoName}-${deriveServiceKey(dockerfilePath)}`,
  ].map((value) => normalizeToken(value)).filter(Boolean));

  const imageTokens = tokenizeImageReference(image);
  return [...candidates].some((candidate) => imageTokens.has(candidate));
}

function deriveServiceKey(dockerfilePath: string): string {
  const normalized = dockerfilePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const dirname = path.posix.dirname(normalized);
  if (dirname !== '.') {
    return path.posix.basename(dirname);
  }
  return path.posix.basename(normalized).replace(/^dockerfile[._-]?/i, '') || 'dockerfile';
}

function inferRepoNameFromImage(image: string, repoNames: string[]): string | undefined {
  const tokens = tokenizeImageReference(image);
  return repoNames.find((repoName) => tokens.has(normalizeToken(repoName)));
}

function tokenizeImageReference(image: string): Set<string> {
  const normalized = normalizeImageReference(image);
  const slashParts = normalized.split('/').filter(Boolean);
  const tokens = new Set<string>();
  for (const part of slashParts) {
    const token = normalizeToken(part);
    if (token) tokens.add(token);
    for (const subPart of part.split(/[-_.]/)) {
      const subToken = normalizeToken(subPart);
      if (subToken) tokens.add(subToken);
    }
  }
  return tokens;
}

function normalizeImageReference(image: string): string {
  let normalized = image.trim().toLowerCase();
  const digestIndex = normalized.indexOf('@');
  if (digestIndex >= 0) {
    normalized = normalized.slice(0, digestIndex);
  }

  const slashIndex = normalized.lastIndexOf('/');
  const colonIndex = normalized.lastIndexOf(':');
  if (colonIndex > slashIndex) {
    normalized = normalized.slice(0, colonIndex);
  }

  if (!normalized.includes('/')) {
    return `docker.io/library/${normalized}`;
  }

  const parts = normalized.split('/');
  const first = parts[0];
  const looksLikeRegistry = first.includes('.') || first.includes(':') || first === 'localhost';
  if (!looksLikeRegistry) {
    return `docker.io/${normalized}`;
  }

  return normalized;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}
