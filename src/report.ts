import { projectGraph, ProjectEdge, ProjectGraphOptions, ProjectNode } from './project.js';
import { ScanGraph } from './types.js';

const DETAIL_LIMIT = 40;
const HOTSPOT_LIMIT = 10;

export interface JsonReport {
  generatedAt: string;
  view: ReturnType<typeof projectGraph>['view'];
  options: ReturnType<typeof projectGraph>['options'];
  summary: {
    scope: string;
    ownership: { configured: number; inferred: number; unresolved: number };
    diagnostics: { warnings: number; sourceErrors: number };
    scan: ReturnType<typeof projectGraph>['metadata'];
    projection: {
      nodes: number;
      edges: number;
      unresolvedImages: number;
      internalEdges: number;
      externalEdges: number;
    };
  };
  repoProvenance: Array<{
    name: string;
    source?: ScanGraph['repos'][number]['source'];
  }>;
  warnings: Array<{ code: string; location: string; message: string }>;
  sourceDiagnostics: ReturnType<typeof projectGraph>['metadata']['sourceDiagnostics'];
  hotspots: {
    topTargets: Array<{ id: string; label: string; count: number; scope: string; kind: string }>;
    topExternalDependencies: Array<{ image: string; count: number }>;
  };
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  unresolvedImages: string[];
}

export function renderTextReport(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  const projected = projectGraph(graph, options);
  const json = buildJsonReport(graph, options);
  const lines: string[] = [];

  lines.push('repo-graph report');
  lines.push(`Generated: ${projected.generatedAt}`);
  lines.push(`View: ${projected.view}`);
  if (projected.options.focus) {
    lines.push(`Focus: ${projected.options.focus}`);
    lines.push(`Depth: ${projected.options.depth}`);
  }
  lines.push(`External images: ${projected.options.includeExternal ? 'included' : 'excluded'}`);
  lines.push('');

  lines.push('Summary:');
  lines.push(`  Scope: ${json.summary.scope}`);
  lines.push(`  Ownership: ${json.summary.ownership.configured} configured, ${json.summary.ownership.inferred} inferred, ${json.summary.ownership.unresolved} unresolved`);
  lines.push(`  Diagnostics: ${json.summary.diagnostics.warnings} warnings, ${json.summary.diagnostics.sourceErrors} source errors`);
  lines.push(`  Projection: ${json.summary.projection.nodes} nodes, ${json.summary.projection.edges} edges (${json.summary.projection.internalEdges} internal, ${json.summary.projection.externalEdges} external)`);
  lines.push('');

  lines.push('Scan metadata:');
  lines.push(`  Repos: ${projected.metadata.repoCount}`);
  lines.push(`  Dockerfiles: ${projected.metadata.dockerfileCount}`);
  lines.push(`  Dependencies: ${projected.metadata.dependencyCount}`);
  lines.push(`  Internal edges: ${projected.metadata.internalEdgeCount}`);
  lines.push(`  External edges: ${projected.metadata.externalEdgeCount}`);
  lines.push(`  Unresolved images: ${projected.metadata.unresolvedCount}`);
  lines.push(`  Warnings: ${projected.metadata.warningCount}`);
  if (projected.metadata.dockerfilePatterns.length) {
    lines.push(`  Dockerfile patterns: ${projected.metadata.dockerfilePatterns.join(', ')}`);
  }
  lines.push('');

  lines.push('Dependency hotspots:');
  if (!json.hotspots.topTargets.length) {
    lines.push('  - none');
  } else {
    for (const hotspot of json.hotspots.topTargets) {
      lines.push(`  - ${hotspot.label} [${hotspot.kind}/${hotspot.scope}] <- ${hotspot.count} dependent edge(s)`);
    }
  }
  lines.push('');

  lines.push('Common external dependencies:');
  if (!json.hotspots.topExternalDependencies.length) {
    lines.push('  - none');
  } else {
    for (const dependency of json.hotspots.topExternalDependencies) {
      lines.push(`  - ${dependency.image} <- ${dependency.count} dependent edge(s)`);
    }
  }
  lines.push('');

  lines.push('Repo provenance:');
  for (const repo of json.repoProvenance) {
    if (!repo.source) {
      lines.push(`  - ${repo.name}: none`);
      continue;
    }
    const details = [
      `source=${repo.source.source}`,
      repo.source.requestedRef ? `requested=${repo.source.requestedRef}` : undefined,
      repo.source.resolvedRef ? `resolved=${repo.source.resolvedRef}` : undefined,
      repo.source.resolvedCommit ? `commit=${repo.source.resolvedCommit}` : undefined,
      `acquisition=${repo.source.acquisition}`,
    ].filter(Boolean).join(', ');
    lines.push(`  - ${repo.name}: ${details}`);
  }
  lines.push('');

  lines.push('Warnings:');
  if (!json.warnings.length) {
    lines.push('  - none');
  } else {
    for (const warning of json.warnings) {
      lines.push(`  - [${warning.code}] ${warning.location}: ${warning.message}`);
    }
  }
  lines.push('');

  lines.push('Source diagnostics:');
  if (!json.sourceDiagnostics.length) {
    lines.push('  - none');
  } else {
    for (const diagnostic of json.sourceDiagnostics) {
      const extra = diagnostic.ref ? ` (ref: ${diagnostic.ref})` : '';
      lines.push(`  - [${diagnostic.severity}] ${diagnostic.repo}: ${diagnostic.message}${extra}`);
      if (diagnostic.details) {
        lines.push(`    ${diagnostic.details}`);
      }
    }
  }
  lines.push('');

  renderDetailedTextSection(lines, 'Ownership audit:', projected.edges, (edge) => {
    const source = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
    const target = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
    const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
    const matchedBy = graphEdge?.metadata.matchedBy ?? 'unknown';
    const reason = graphEdge?.metadata.reason ?? '';
    return `  - ${source} -> ${target}: ${edge.confidence} via ${matchedBy}${reason ? ` (${reason})` : ''}`;
  });

  renderDetailedTextSection(lines, 'Nodes:', projected.nodes, (node) => `  - ${node.label} [${node.kind}/${node.scope}]`);

  renderDetailedTextSection(lines, 'Edges:', projected.edges, (edge) => {
    const from = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
    const to = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
    const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
    const explain = [graphEdge?.metadata.matchedBy, graphEdge?.metadata.reason].filter(Boolean).join('; ');
    return `  - ${from} -> ${to} [${edge.confidence}] (${edge.rawDependency}${explain ? ` | ${explain}` : ''})`;
  });

  lines.push('Unresolved image ownership:');
  if (!projected.unresolvedImages.length) {
    lines.push('  - none');
  } else {
    for (const image of projected.unresolvedImages) {
      lines.push(`  - ${image}`);
    }
  }

  return lines.join('\n');
}

export function renderMarkdownReport(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  const projected = projectGraph(graph, options);
  const json = buildJsonReport(graph, options);
  const lines: string[] = [];

  lines.push('# repo-graph report');
  lines.push('');
  lines.push(`- Generated: ${projected.generatedAt}`);
  lines.push(`- View: ${projected.view}`);
  if (projected.options.focus) {
    lines.push(`- Focus: ${projected.options.focus}`);
    lines.push(`- Depth: ${projected.options.depth}`);
  }
  lines.push(`- External images: ${projected.options.includeExternal ? 'included' : 'excluded'}`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`- Scope: ${json.summary.scope}`);
  lines.push(`- Ownership: ${json.summary.ownership.configured} configured, ${json.summary.ownership.inferred} inferred, ${json.summary.ownership.unresolved} unresolved`);
  lines.push(`- Diagnostics: ${json.summary.diagnostics.warnings} warnings, ${json.summary.diagnostics.sourceErrors} source errors`);
  lines.push(`- Projection: ${json.summary.projection.nodes} nodes, ${json.summary.projection.edges} edges (${json.summary.projection.internalEdges} internal, ${json.summary.projection.externalEdges} external)`);
  lines.push('');

  lines.push('## Scan metadata');
  lines.push('');
  lines.push(`- Repos: ${projected.metadata.repoCount}`);
  lines.push(`- Dockerfiles: ${projected.metadata.dockerfileCount}`);
  lines.push(`- Dependencies: ${projected.metadata.dependencyCount}`);
  lines.push(`- Internal edges: ${projected.metadata.internalEdgeCount}`);
  lines.push(`- External edges: ${projected.metadata.externalEdgeCount}`);
  lines.push(`- Unresolved images: ${projected.metadata.unresolvedCount}`);
  lines.push(`- Warnings: ${projected.metadata.warningCount}`);
  if (projected.metadata.dockerfilePatterns.length) {
    lines.push(`- Dockerfile patterns: ${projected.metadata.dockerfilePatterns.join(', ')}`);
  }
  lines.push('');

  lines.push('## Dependency hotspots');
  lines.push('');
  if (!json.hotspots.topTargets.length) {
    lines.push('- none');
  } else {
    for (const hotspot of json.hotspots.topTargets) {
      lines.push(`- \`${hotspot.label}\` — ${hotspot.kind}/${hotspot.scope}, ${hotspot.count} dependent edge(s)`);
    }
  }
  lines.push('');

  lines.push('## Common external dependencies');
  lines.push('');
  if (!json.hotspots.topExternalDependencies.length) {
    lines.push('- none');
  } else {
    for (const dependency of json.hotspots.topExternalDependencies) {
      lines.push(`- \`${dependency.image}\` — ${dependency.count} dependent edge(s)`);
    }
  }
  lines.push('');

  lines.push('## Repo provenance');
  lines.push('');
  if (!graph.repos.length) {
    lines.push('- none');
  } else {
    for (const repo of json.repoProvenance) {
      if (!repo.source) {
        lines.push(`- **${repo.name}**: none`);
        continue;
      }
      const details = [
        `source=\`${repo.source.source}\``,
        repo.source.requestedRef ? `requested=\`${repo.source.requestedRef}\`` : undefined,
        repo.source.resolvedRef ? `resolved=\`${repo.source.resolvedRef}\`` : undefined,
        repo.source.resolvedCommit ? `commit=\`${repo.source.resolvedCommit}\`` : undefined,
        `acquisition=\`${repo.source.acquisition}\``,
      ].filter(Boolean).join(', ');
      lines.push(`- **${repo.name}**: ${details}`);
    }
  }
  lines.push('');

  lines.push('## Warnings');
  lines.push('');
  if (!json.warnings.length) {
    lines.push('- none');
  } else {
    for (const warning of json.warnings) {
      lines.push(`- [${warning.code}] **${warning.location}**: ${warning.message}`);
    }
  }
  lines.push('');

  lines.push('## Source diagnostics');
  lines.push('');
  if (!json.sourceDiagnostics.length) {
    lines.push('- none');
  } else {
    for (const diagnostic of json.sourceDiagnostics) {
      const extra = diagnostic.ref ? ` (ref: \`${diagnostic.ref}\`)` : '';
      lines.push(`- **${diagnostic.severity}** \`${diagnostic.repo}\`: ${diagnostic.message}${extra}`);
      if (diagnostic.details) {
        lines.push(`  - ${diagnostic.details}`);
      }
    }
  }
  lines.push('');

  renderDetailedMarkdownSection(lines, '## Ownership audit', projected.edges, (edge) => {
    const source = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
    const target = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
    const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
    const matchedBy = graphEdge?.metadata.matchedBy ?? 'unknown';
    const reason = graphEdge?.metadata.reason ?? '';
    return `- \`${source}\` → \`${target}\` — **${edge.confidence}** via \`${matchedBy}\`${reason ? ` (${reason})` : ''}`;
  });

  renderDetailedMarkdownSection(lines, '## Nodes', projected.nodes, (node) => `- \`${node.label}\` — ${node.kind}/${node.scope}`);

  renderDetailedMarkdownSection(lines, '## Edges', projected.edges, (edge) => {
    const from = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
    const to = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
    const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
    const explain = [graphEdge?.metadata.matchedBy, graphEdge?.metadata.reason].filter(Boolean).join('; ');
    return `- \`${from}\` → \`${to}\` — **${edge.confidence}** (raw: \`${edge.rawDependency}\`${explain ? `, explain: \`${explain}\`` : ''})`;
  });

  lines.push('## Unresolved image ownership');
  lines.push('');
  if (!projected.unresolvedImages.length) {
    lines.push('- none');
  } else {
    for (const image of projected.unresolvedImages) {
      lines.push(`- \`${image}\``);
    }
  }

  return lines.join('\n');
}

export function renderJsonReport(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  return `${JSON.stringify(buildJsonReport(graph, options), null, 2)}\n`;
}

export function buildJsonReport(graph: ScanGraph, options: ProjectGraphOptions = {}): JsonReport {
  const projected = projectGraph(graph, options);
  const warnings = collectWarnings(graph);
  const sourceErrors = projected.metadata.sourceDiagnostics.filter((diagnostic) => diagnostic.severity === 'error');

  return {
    generatedAt: projected.generatedAt,
    view: projected.view,
    options: projected.options,
    summary: {
      scope: summaryScope(projected),
      ownership: summarizeOwnership(projected),
      diagnostics: { warnings: warnings.length, sourceErrors: sourceErrors.length },
      scan: projected.metadata,
      projection: {
        nodes: projected.nodes.length,
        edges: projected.edges.length,
        unresolvedImages: projected.unresolvedImages.length,
        internalEdges: projected.edges.filter((edge) => edge.internal).length,
        externalEdges: projected.edges.filter((edge) => !edge.internal).length,
      },
    },
    repoProvenance: graph.repos
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((repo) => ({ name: repo.name, source: repo.source })),
    warnings,
    sourceDiagnostics: projected.metadata.sourceDiagnostics,
    hotspots: collectHotspots(projected),
    nodes: projected.nodes,
    edges: projected.edges,
    unresolvedImages: projected.unresolvedImages,
  };
}

function renderDetailedTextSection<T>(lines: string[], title: string, items: T[], render: (item: T) => string): void {
  lines.push(title);
  if (!items.length) {
    lines.push('  - none');
    lines.push('');
    return;
  }

  for (const item of items.slice(0, DETAIL_LIMIT)) {
    lines.push(render(item));
  }
  if (items.length > DETAIL_LIMIT) {
    lines.push(`  - ... ${items.length - DETAIL_LIMIT} more omitted; use --focus/--depth or --format json for the full projection`);
  }
  lines.push('');
}

function renderDetailedMarkdownSection<T>(lines: string[], title: string, items: T[], render: (item: T) => string): void {
  lines.push(title);
  lines.push('');
  if (!items.length) {
    lines.push('- none');
    lines.push('');
    return;
  }

  for (const item of items.slice(0, DETAIL_LIMIT)) {
    lines.push(render(item));
  }
  if (items.length > DETAIL_LIMIT) {
    lines.push(`- ... ${items.length - DETAIL_LIMIT} more omitted; use \`--focus\`/\`--depth\` or \`--format json\` for the full projection`);
  }
  lines.push('');
}

function collectWarnings(graph: ScanGraph): Array<{ code: string; location: string; message: string }> {
  return graph.repos
    .flatMap((repo) => repo.dockerfiles.map((dockerfile) => ({ repo, dockerfile })))
    .flatMap(({ repo, dockerfile }) =>
      dockerfile.warnings.map((warning) => ({
        code: warning.code,
        location: `${repo.name}/${dockerfile.path}${warning.line ? `:${warning.line}` : ''}`,
        message: warning.message,
      })),
    )
    .sort((a, b) => `${a.location}:${a.code}:${a.message}`.localeCompare(`${b.location}:${b.code}:${b.message}`));
}

function summarizeOwnership(graph: ReturnType<typeof projectGraph>): { configured: number; inferred: number; unresolved: number } {
  return graph.edges.reduce(
    (summary, edge) => {
      summary[edge.confidence] += 1;
      return summary;
    },
    { configured: 0, inferred: 0, unresolved: 0 },
  );
}

function summaryScope(graph: ReturnType<typeof projectGraph>): string {
  if (graph.options.focus) {
    return `focus=${graph.options.focus}, depth=${graph.options.depth}`;
  }
  return 'full graph';
}

function collectHotspots(graph: ReturnType<typeof projectGraph>): JsonReport['hotspots'] {
  const nodeIndex = new Map(graph.nodes.map((node) => [node.id, node]));
  const targetCounts = new Map<string, number>();
  const externalCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    targetCounts.set(edge.to, (targetCounts.get(edge.to) ?? 0) + 1);
    const targetNode = nodeIndex.get(edge.to);
    if (targetNode?.scope === 'external') {
      externalCounts.set(targetNode.label, (externalCounts.get(targetNode.label) ?? 0) + 1);
    }
  }

  return {
    topTargets: [...targetCounts.entries()]
      .map(([id, count]) => {
        const node = nodeIndex.get(id);
        return {
          id,
          label: node?.label ?? id,
          count,
          scope: node?.scope ?? 'internal',
          kind: node?.kind ?? 'image',
        };
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, HOTSPOT_LIMIT),
    topExternalDependencies: [...externalCounts.entries()]
      .map(([image, count]) => ({ image, count }))
      .sort((a, b) => b.count - a.count || a.image.localeCompare(b.image))
      .slice(0, HOTSPOT_LIMIT),
  };
}
