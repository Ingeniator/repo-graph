import { projectGraph, ProjectGraphOptions } from './project.js';
import { ScanGraph } from './types.js';

export function renderTextReport(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  const projected = projectGraph(graph, options);
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
      lines.push(`  - ${from} -> ${to} [${edge.confidence}] (${edge.rawDependency})`);
    }
  }
  lines.push('');

  lines.push('Source diagnostics:');
  if (!projected.metadata.sourceDiagnostics.length) {
    lines.push('  - none');
  } else {
    for (const diagnostic of projected.metadata.sourceDiagnostics) {
      lines.push(`  - [${diagnostic.severity}] ${diagnostic.repo}: ${diagnostic.message}`);
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
      lines.push(`- \`${from}\` → \`${to}\` — **${edge.confidence}** (raw: \`${edge.rawDependency}\`)`);
    }
  }
  lines.push('');

  lines.push('## Source diagnostics');
  lines.push('');
  if (!projected.metadata.sourceDiagnostics.length) {
    lines.push('- none');
  } else {
    for (const diagnostic of projected.metadata.sourceDiagnostics) {
      lines.push(`- **${diagnostic.severity}** \`${diagnostic.repo}\`: ${diagnostic.message}`);
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
