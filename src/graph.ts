import { RawConfig, ScanGraph, RepoNode, GraphEdge, OwnershipResolution, ResolutionConfidence } from './types.js';
import { discoverDockerfiles } from './fs-utils.js';
import { parseDockerfile } from './dockerfile-parser.js';

export function buildGraph(config: RawConfig): ScanGraph {
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

  for (const repo of repos) {
    for (const dockerfile of repo.dockerfiles) {
      for (const dependency of dockerfile.dependencies) {
        const ownership = resolveOwnership(config, repos, dependency.resolved);
        dependency.ownership = ownership;
        dependency.confidence = ownership.confidence;

        if (ownership.confidence === 'unresolved') {
          unresolvedImages.add(dependency.resolved);
        }

        edges.push({
          from: dockerfile.id,
          to: ownership.repo ?? dependency.resolved,
          kind: 'depends_on',
          confidence: ownership.confidence,
          metadata: {
            dependency: dependency.resolved,
            sourceInstruction: dependency.sourceInstruction,
            repo: ownership.repo,
            dockerfile: ownership.dockerfile,
            reason: ownership.reason,
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
    confidence: image.includes('${') ? 'unresolved' : 'unresolved',
    reason: image.includes('${') ? 'contains unresolved ARG substitution' : 'no configured or inferred owner found',
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
