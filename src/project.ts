import { GraphEdge, RepoNode, ResolutionConfidence, ScanGraph, ViewType } from './types.js';

export interface ProjectGraphOptions {
  view?: ViewType;
  focus?: string;
  depth?: number;
  includeExternal?: boolean;
  excludeExternal?: boolean;
}

export interface ProjectNode {
  id: string;
  label: string;
  kind: 'repo' | 'dockerfile' | 'image';
  scope: 'internal' | 'external';
}

export interface ProjectEdge {
  from: string;
  to: string;
  confidence: ResolutionConfidence;
  rawDependency: string;
  internal: boolean;
}

export interface ProjectedGraph {
  generatedAt: string;
  view: ViewType;
  options: Required<ProjectGraphOptions>;
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  unresolvedImages: string[];
  metadata: ScanGraph['metadata'];
}

export function projectGraph(graph: ScanGraph, options: ProjectGraphOptions = {}): ProjectedGraph {
  const normalized: Required<ProjectGraphOptions> = {
    view: options.view ?? 'dockerfile',
    focus: options.focus ?? '',
    depth: options.depth ?? Number.MAX_SAFE_INTEGER,
    includeExternal: options.excludeExternal ? false : (options.includeExternal ?? true),
    excludeExternal: options.excludeExternal ?? false,
  };

  const nodes = new Map<string, ProjectNode>();
  const edges = new Map<string, ProjectEdge>();
  const seedNodes = normalized.focus ? new Set<string>(findFocusNodeIds(graph, normalized.view, normalized.focus)) : undefined;
  const ownerImageIndex = buildOwnerImageIndex(graph.repos);

  for (const edge of graph.edges) {
    const projected = projectEdge(graph.repos, edge, normalized.view, ownerImageIndex);
    if (!projected) continue;
    if (!normalized.includeExternal && !projected.internal) continue;

    const fromNode = projected.from;
    const toNode = projected.to;
    nodes.set(fromNode.id, fromNode);
    nodes.set(toNode.id, toNode);

    const key = `${fromNode.id}->${toNode.id}:${projected.confidence}`;
    if (!edges.has(key)) {
      edges.set(key, {
        from: fromNode.id,
        to: toNode.id,
        confidence: projected.confidence,
        rawDependency: projected.rawDependency,
        internal: projected.internal,
      });
    }
  }

  let filteredEdges = [...edges.values()];
  let filteredNodes = new Map(nodes);

  if (seedNodes?.size) {
    const keptNodeIds = collectNeighborhood(filteredEdges, seedNodes, normalized.depth);
    filteredEdges = filteredEdges.filter((edge) => keptNodeIds.has(edge.from) && keptNodeIds.has(edge.to));
    filteredNodes = new Map([...filteredNodes.entries()].filter(([id]) => keptNodeIds.has(id)));
  }

  const unresolvedImages = graph.unresolvedImages.filter((image) => {
    if (normalized.includeExternal) return true;
    return filteredEdges.some((edge) => edge.rawDependency === image && edge.internal);
  });

  return {
    generatedAt: graph.generatedAt,
    view: normalized.view,
    options: normalized,
    nodes: [...filteredNodes.values()].sort((a, b) => a.label.localeCompare(b.label)),
    edges: filteredEdges.sort((a, b) => `${a.from}->${a.to}:${a.confidence}`.localeCompare(`${b.from}->${b.to}:${b.confidence}`)),
    unresolvedImages,
    metadata: graph.metadata,
  };
}

function findFocusNodeIds(graph: ScanGraph, view: ViewType, focus: string): string[] {
  const needle = focus.toLowerCase();
  const ownerImageIndex = buildOwnerImageIndex(graph.repos);
  const ids = new Set<string>();

  for (const repo of graph.repos) {
    if (view === 'repo' && repo.name.toLowerCase().includes(needle)) {
      ids.add(repo.name);
    }

    for (const dockerfile of repo.dockerfiles) {
      const dockerfileLabel = `${repo.name}/${dockerfile.path}`.toLowerCase();
      if (view === 'dockerfile' && (dockerfile.id.toLowerCase().includes(needle) || dockerfileLabel.includes(needle))) {
        ids.add(dockerfile.id);
      }

      if (view === 'image') {
        for (const node of getImageViewNodesForDockerfile(repo, dockerfile)) {
          if (node.label.toLowerCase().includes(needle)) {
            ids.add(node.id);
          }
        }
      }
    }
  }

  for (const edge of graph.edges) {
    const projected = projectEdge(graph.repos, edge, view, ownerImageIndex);
    if (!projected) continue;
    if (projected.from.label.toLowerCase().includes(needle) || projected.to.label.toLowerCase().includes(needle)) {
      ids.add(projected.from.id);
      ids.add(projected.to.id);
    }
    if (edge.metadata.dependency?.toLowerCase().includes(needle)) {
      ids.add(projected.to.id);
    }
  }

  return [...ids];
}

function collectNeighborhood(edges: ProjectEdge[], seeds: Set<string>, depth: number): Set<string> {
  const kept = new Set<string>(seeds);
  if (depth <= 0) {
    return kept;
  }

  let frontier = new Set<string>(seeds);
  for (let level = 0; level < depth; level += 1) {
    const next = new Set<string>();
    for (const edge of edges) {
      if (frontier.has(edge.from) || frontier.has(edge.to)) {
        if (!kept.has(edge.from)) next.add(edge.from);
        if (!kept.has(edge.to)) next.add(edge.to);
        kept.add(edge.from);
        kept.add(edge.to);
      }
    }
    if (!next.size) break;
    frontier = next;
  }

  return kept;
}

function buildOwnerImageIndex(repos: RepoNode[]): Map<string, ProjectNode[]> {
  const index = new Map<string, ProjectNode[]>();
  for (const repo of repos) {
    for (const dockerfile of repo.dockerfiles) {
      const key = `${repo.name}:${dockerfile.path}`;
      index.set(key, getImageViewNodesForDockerfile(repo, dockerfile));
    }
  }
  return index;
}

function projectEdge(repos: RepoNode[], edge: GraphEdge, view: ViewType, ownerImageIndex: Map<string, ProjectNode[]>) {
  const sourceRepo = repos.find((repo) => repo.dockerfiles.some((dockerfile) => dockerfile.id === edge.from));
  const sourceDockerfile = sourceRepo?.dockerfiles.find((dockerfile) => dockerfile.id === edge.from);
  if (!sourceRepo || !sourceDockerfile) return undefined;

  const ownerDockerfileKey = edge.metadata.repo && edge.metadata.dockerfile ? `${edge.metadata.repo}:${edge.metadata.dockerfile}` : undefined;
  const ownerImages = ownerDockerfileKey ? ownerImageIndex.get(ownerDockerfileKey) : undefined;
  const internal = edge.metadata.targetScope === 'internal';

  if (view === 'repo') {
    return {
      from: { id: sourceRepo.name, label: sourceRepo.name, kind: 'repo' as const, scope: 'internal' as const },
      to: {
        id: internal ? (edge.metadata.repo ?? edge.to) : edge.metadata.dependency ?? edge.to,
        label: internal ? (edge.metadata.repo ?? edge.to) : (edge.metadata.dependency ?? edge.to),
        kind: internal ? ('repo' as const) : ('image' as const),
        scope: internal ? ('internal' as const) : ('external' as const),
      },
      confidence: edge.confidence,
      rawDependency: edge.metadata.dependency ?? edge.to,
      internal,
    };
  }

  if (view === 'image') {
    const sourceImages = getImageViewNodesForDockerfile(sourceRepo, sourceDockerfile);
    const targetImages = internal
      ? (ownerImages?.length ? ownerImages : [{ id: edge.metadata.dependency ?? edge.to, label: edge.metadata.dependency ?? edge.to, kind: 'image' as const, scope: 'internal' as const }])
      : [{ id: edge.metadata.dependency ?? edge.to, label: edge.metadata.dependency ?? edge.to, kind: 'image' as const, scope: 'external' as const }];
    return {
      from: sourceImages[0],
      to: targetImages[0],
      confidence: edge.confidence,
      rawDependency: edge.metadata.dependency ?? edge.to,
      internal,
    };
  }

  return {
    from: {
      id: sourceDockerfile.id,
      label: `${sourceRepo.name}/${sourceDockerfile.path}`,
      kind: 'dockerfile' as const,
      scope: 'internal' as const,
    },
    to: {
      id: internal && edge.metadata.repo && edge.metadata.dockerfile ? `${edge.metadata.repo}:${edge.metadata.dockerfile}` : (edge.metadata.dependency ?? edge.to),
      label: internal && edge.metadata.repo && edge.metadata.dockerfile
        ? `${edge.metadata.repo}/${edge.metadata.dockerfile}`
        : (edge.metadata.dependency ?? edge.to),
      kind: internal ? ('dockerfile' as const) : ('image' as const),
      scope: internal ? ('internal' as const) : ('external' as const),
    },
    confidence: edge.confidence,
    rawDependency: edge.metadata.dependency ?? edge.to,
    internal,
  };
}

function getImageViewNodesForDockerfile(repo: RepoNode, dockerfile: RepoNode['dockerfiles'][number]): ProjectNode[] {
  if (dockerfile.declaredImages.length) {
    return dockerfile.declaredImages.map((image) => ({
      id: image,
      label: image,
      kind: 'image' as const,
      scope: 'internal' as const,
    }));
  }

  return [{
    id: `internal-image:${repo.name}:${dockerfile.path}`,
    label: `${repo.name}/${dockerfile.path}`,
    kind: 'image' as const,
    scope: 'internal' as const,
  }];
}
