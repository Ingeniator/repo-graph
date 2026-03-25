import { RawConfig, ScanGraph, RepoNode, GraphEdge, OwnershipResolution, SourceDiagnostic } from './types.js';
import { discoverDockerfiles } from './fs-utils.js';
import { parseDockerfile } from './dockerfile-parser.js';

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
  const configured = config.imageOwnership?.[image];
  if (configured) {
    return {
      repo: configured.repo,
      dockerfile: configured.dockerfile,
      confidence: configured.confidence ?? 'configured',
      reason: 'matched via imageOwnership config',
    };
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

function inferOwnership(repos: RepoNode[], image: string): OwnershipResolution | undefined {
  for (const repo of repos) {
    for (const dockerfile of repo.dockerfiles) {
      if (dockerfile.declaredImages.includes(image)) {
        return {
          repo: repo.name,
          dockerfile: dockerfile.path,
          confidence: 'inferred',
          reason: 'matched configured image declaration on a discovered dockerfile',
        };
      }
    }
  }

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

function inferRepoNameFromImage(image: string, repoNames: string[]): string | undefined {
  const normalized = image.toLowerCase();
  return repoNames.find((repoName) => normalized.includes(repoName.toLowerCase()));
}
