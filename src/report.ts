import { projectGraph, ProjectGraphOptions } from './project.js';
import { ScanGraph } from './types.js';

export function renderTextReport(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  const projected = projectGraph(graph, options);
  const lines: string[] = [];
  const warnings = collectWarnings(graph);
  const sourceErrors = projected.metadata.sourceDiagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const ownership = summarizeOwnership(projected);

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
  lines.push(`  Scope: ${summaryScope(projected)}`);
  lines.push(`  Ownership: ${ownership.configured} configured, ${ownership.inferred} inferred, ${ownership.unresolved} unresolved`);
  lines.push(`  Diagnostics: ${warnings.length} warnings, ${sourceErrors.length} source errors`);
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

  lines.push('Repo provenance:');
  for (const repo of graph.repos.sort((a, b) => a.name.localeCompare(b.name))) {
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
  if (!warnings.length) {
    lines.push('  - none');
  } else {
    for (const warning of warnings) {
      lines.push(`  - [${warning.code}] ${warning.location}: ${warning.message}`);
    }
  }
  lines.push('');

  lines.push('Source diagnostics:');
  if (!projected.metadata.sourceDiagnostics.length) {
    lines.push('  - none');
  } else {
    for (const diagnostic of projected.metadata.sourceDiagnostics) {
      const extra = diagnostic.ref ? ` (ref: ${diagnostic.ref})` : '';
      lines.push(`  - [${diagnostic.severity}] ${diagnostic.repo}: ${diagnostic.message}${extra}`);
      if (diagnostic.details) {
        lines.push(`    ${diagnostic.details}`);
      }
    }
  }
  lines.push('');

  lines.push('Ownership audit:');
  if (!projected.edges.length) {
    lines.push('  - none');
  } else {
    for (const edge of projected.edges) {
      const source = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
      const target = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
      const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
      const matchedBy = graphEdge?.metadata.matchedBy ?? 'unknown';
      const reason = graphEdge?.metadata.reason ?? '';
      lines.push(`  - ${source} -> ${target}: ${edge.confidence} via ${matchedBy}${reason ? ` (${reason})` : ''}`);
    }
  }
  lines.push('');

  lines.push('Nodes:');
  for (const node of projected.nodes) {
    lines.push(`  - ${node.label} [${node.kind}/${node.scope}]`);
  }
  lines.push('');

  lines.push('Edges:');
  if (!projected.edges.length) {
    lines.push('  - none');
  } else {
    for (const edge of projected.edges) {
      const from = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
      const to = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
      const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
      const explain = [graphEdge?.metadata.matchedBy, graphEdge?.metadata.reason].filter(Boolean).join('; ');
      lines.push(`  - ${from} -> ${to} [${edge.confidence}] (${edge.rawDependency}${explain ? ` | ${explain}` : ''})`);
    }
  }
  lines.push('');

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
  const lines: string[] = [];
  const warnings = collectWarnings(graph);
  const sourceErrors = projected.metadata.sourceDiagnostics.filter((diagnostic) => diagnostic.severity === 'error');
  const ownership = summarizeOwnership(projected);

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
  lines.push(`- Scope: ${summaryScope(projected)}`);
  lines.push(`- Ownership: ${ownership.configured} configured, ${ownership.inferred} inferred, ${ownership.unresolved} unresolved`);
  lines.push(`- Diagnostics: ${warnings.length} warnings, ${sourceErrors.length} source errors`);
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

  lines.push('## Repo provenance');
  lines.push('');
  if (!graph.repos.length) {
    lines.push('- none');
  } else {
    for (const repo of graph.repos.sort((a, b) => a.name.localeCompare(b.name))) {
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
  if (!warnings.length) {
    lines.push('- none');
  } else {
    for (const warning of warnings) {
      lines.push(`- [${warning.code}] **${warning.location}**: ${warning.message}`);
    }
  }
  lines.push('');

  lines.push('## Source diagnostics');
  lines.push('');
  if (!projected.metadata.sourceDiagnostics.length) {
    lines.push('- none');
  } else {
    for (const diagnostic of projected.metadata.sourceDiagnostics) {
      const extra = diagnostic.ref ? ` (ref: \`${diagnostic.ref}\`)` : '';
      lines.push(`- **${diagnostic.severity}** \`${diagnostic.repo}\`: ${diagnostic.message}${extra}`);
      if (diagnostic.details) {
        lines.push(`  - ${diagnostic.details}`);
      }
    }
  }
  lines.push('');

  lines.push('## Ownership audit');
  lines.push('');
  if (!projected.edges.length) {
    lines.push('- none');
  } else {
    for (const edge of projected.edges) {
      const source = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
      const target = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
      const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
      const matchedBy = graphEdge?.metadata.matchedBy ?? 'unknown';
      const reason = graphEdge?.metadata.reason ?? '';
      lines.push(`- \`${source}\` → \`${target}\` — **${edge.confidence}** via \`${matchedBy}\`${reason ? ` (${reason})` : ''}`);
    }
  }
  lines.push('');

  lines.push('## Nodes');
  lines.push('');
  if (!projected.nodes.length) {
    lines.push('- none');
  } else {
    for (const node of projected.nodes) {
      lines.push(`- \`${node.label}\` — ${node.kind}/${node.scope}`);
    }
  }
  lines.push('');

  lines.push('## Edges');
  lines.push('');
  if (!projected.edges.length) {
    lines.push('- none');
  } else {
    for (const edge of projected.edges) {
      const from = projected.nodes.find((node) => node.id === edge.from)?.label ?? edge.from;
      const to = projected.nodes.find((node) => node.id === edge.to)?.label ?? edge.to;
      const graphEdge = graph.edges.find((candidate) => candidate.from === edge.from && candidate.metadata.dependency === edge.rawDependency);
      const explain = [graphEdge?.metadata.matchedBy, graphEdge?.metadata.reason].filter(Boolean).join('; ');
      lines.push(`- \`${from}\` → \`${to}\` — **${edge.confidence}** (raw: \`${edge.rawDependency}\`${explain ? `, explain: \`${explain}\`` : ''})`);
    }
  }
  lines.push('');

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
