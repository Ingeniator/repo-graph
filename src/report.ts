import { ScanGraph } from './types.js';

export function renderTextReport(graph: ScanGraph): string {
  const lines: string[] = [];

  lines.push('repo-graph report');
  lines.push(`Generated: ${graph.generatedAt}`);
  lines.push('');

  for (const repo of graph.repos) {
    lines.push(`Repo: ${repo.name}`);
    lines.push(`  Path: ${repo.path}`);
    lines.push(`  Dockerfiles: ${repo.dockerfiles.length}`);
    for (const dockerfile of repo.dockerfiles) {
      lines.push(`    - ${dockerfile.path}`);
      for (const dependency of dockerfile.dependencies) {
        const target = dependency.ownership?.repo ?? dependency.resolved;
        lines.push(`      -> ${target} [${dependency.confidence}] (${dependency.resolved})`);
      }
    }
    lines.push('');
  }

  lines.push('Unresolved image ownership:');
  if (!graph.unresolvedImages.length) {
    lines.push('  - none');
  } else {
    for (const image of graph.unresolvedImages) {
      lines.push(`  - ${image}`);
    }
  }

  return lines.join('\n');
}
