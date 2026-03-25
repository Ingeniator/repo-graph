import { ScanGraph } from './types.js';

export function renderMermaid(graph: ScanGraph): string {
  const lines: string[] = ['graph TD'];
  const declaredNodes = new Set<string>();

  for (const repo of graph.repos) {
    declareNode(lines, declaredNodes, repo.name, repo.name);
    for (const dockerfile of repo.dockerfiles) {
      declareNode(lines, declaredNodes, dockerfile.id, `${repo.name}/${dockerfile.path}`);
      lines.push(`  ${nodeId(repo.name)} --> ${nodeId(dockerfile.id)}`);
    }
  }

  for (const edge of graph.edges) {
    declareNode(lines, declaredNodes, edge.to, edge.to);
    lines.push(`  ${nodeId(edge.from)} -->|${edge.confidence}| ${nodeId(edge.to)}`);
  }

  return lines.join('\n');
}

export function renderDot(graph: ScanGraph): string {
  const lines: string[] = ['digraph RepoGraph {'];
  const declaredNodes = new Set<string>();

  for (const repo of graph.repos) {
    declareDotNode(lines, declaredNodes, repo.name, repo.name);
    for (const dockerfile of repo.dockerfiles) {
      declareDotNode(lines, declaredNodes, dockerfile.id, `${repo.name}/${dockerfile.path}`);
      lines.push(`  ${nodeId(repo.name)} -> ${nodeId(dockerfile.id)};`);
    }
  }

  for (const edge of graph.edges) {
    declareDotNode(lines, declaredNodes, edge.to, edge.to);
    lines.push(`  ${nodeId(edge.from)} -> ${nodeId(edge.to)} [label="${edge.confidence}"];`);
  }

  lines.push('}');
  return lines.join('\n');
}

function declareNode(lines: string[], declaredNodes: Set<string>, id: string, label: string): void {
  if (declaredNodes.has(id)) return;
  declaredNodes.add(id);
  lines.push(`  ${nodeId(id)}["${escapeLabel(label)}"]`);
}

function declareDotNode(lines: string[], declaredNodes: Set<string>, id: string, label: string): void {
  if (declaredNodes.has(id)) return;
  declaredNodes.add(id);
  lines.push(`  ${nodeId(id)} [label="${escapeLabel(label)}"];`);
}

function nodeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_]/g, '_');
}

function escapeLabel(value: string): string {
  return value.replace(/"/g, '\\"');
}
