import { ScanGraph } from './types.js';

export function stabilizeGraph(graph: ScanGraph): ScanGraph {
  return {
    generatedAt: '<stable>',
    repos: graph.repos
      .map((repo) => ({
        ...repo,
        path: normalizeFixturePath(repo.path),
        dockerfiles: repo.dockerfiles
          .map((dockerfile) => ({
            ...dockerfile,
            absolutePath: normalizeFixturePath(dockerfile.absolutePath),
            dependencies: dockerfile.dependencies
              .map((dependency) => ({
                ...dependency,
                ownership: dependency.ownership
                  ? {
                      ...dependency.ownership,
                    }
                  : undefined,
              }))
              .sort((a, b) => `${a.resolved}:${a.sourceInstruction}`.localeCompare(`${b.resolved}:${b.sourceInstruction}`)),
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    edges: [...graph.edges]
      .map((edge) => ({
        ...edge,
        metadata: { ...edge.metadata },
      }))
      .sort((a, b) => `${a.from}->${a.to}:${a.confidence}`.localeCompare(`${b.from}->${b.to}:${b.confidence}`)),
    unresolvedImages: [...graph.unresolvedImages].sort(),
  };
}

function normalizeFixturePath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const marker = '/test/fixtures/';
  const index = normalized.indexOf(marker);
  if (index >= 0) {
    return `<repo>${normalized.slice(index)}`;
  }
  return normalized;
}
