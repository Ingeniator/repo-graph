import { projectGraph, ProjectGraphOptions } from './project.js';
import { ScanGraph } from './types.js';

export function renderMermaid(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  const projected = projectGraph(graph, options);
  const lines: string[] = ['graph TD'];
  const declaredNodes = new Set<string>();

  for (const node of projected.nodes) {
    declareNode(lines, declaredNodes, node.id, node.label);
  }

  for (const edge of projected.edges) {
    lines.push(`  ${nodeId(edge.from)} -->|${edge.confidence}| ${nodeId(edge.to)}`);
  }

  return lines.join('\n');
}

export function renderDot(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  const projected = projectGraph(graph, options);
  const lines: string[] = ['digraph RepoGraph {'];
  const declaredNodes = new Set<string>();

  for (const node of projected.nodes) {
    declareDotNode(lines, declaredNodes, node.id, node.label);
  }

  for (const edge of projected.edges) {
    lines.push(`  ${nodeId(edge.from)} -> ${nodeId(edge.to)} [label="${edge.confidence}"];`);
  }

  lines.push('}');
  return lines.join('\n');
}

export function renderSvgRepos(graph: ScanGraph, options: ProjectGraphOptions = {}): string {
  const projected = projectGraph(graph, options);
  const groupedNodes = {
    internal: projected.nodes.filter((node) => node.scope === 'internal'),
    external: projected.nodes.filter((node) => node.scope === 'external'),
  };

  const columns = [
    { title: `${projected.view} nodes`, items: groupedNodes.internal },
    { title: 'External images', items: groupedNodes.external },
  ].filter((column) => column.items.length);

  const width = 1000;
  const headerHeight = 50;
  const rowHeight = 54;
  const boxHeight = 34;
  const columnWidth = 420;
  const margin = 40;
  const columnGap = 60;
  const boxLabelPadding = 14;
  const maxItems = Math.max(...columns.map((column) => column.items.length), 1);
  const height = headerHeight + margin + maxItems * rowHeight + 120;

  const positions = new Map<string, { x: number; y: number; label: string; kind: string; scope: string }>();
  columns.forEach((column, columnIndex) => {
    const x = margin + columnIndex * (columnWidth + columnGap);
    column.items.forEach((item, itemIndex) => {
      const y = headerHeight + margin + itemIndex * rowHeight;
      positions.set(item.id, { x, y, label: item.label, kind: item.kind, scope: item.scope });
    });
  });

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`);
  lines.push(`<style>
  .title { font: 700 24px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #111827; }
  .subtitle { font: 400 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #4b5563; }
  .coltitle { font: 700 16px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #111827; }
  .label { font: 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #111827; }
  .small { font: 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #374151; }
  .edge { stroke: #94a3b8; stroke-width: 2; fill: none; }
  .edge-configured { stroke: #059669; }
  .edge-unresolved { stroke: #dc2626; stroke-dasharray: 6 5; }
  .edge-inferred { stroke: #2563eb; stroke-dasharray: 3 4; }
  .box { stroke: #cbd5e1; stroke-width: 1.2; rx: 10; ry: 10; }
</style>`);
  lines.push(`<defs>
  <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#059669" />
  </marker>
  <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
  </marker>
  <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
  </marker>
</defs>`);
  lines.push(`<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`);
  lines.push(`<text x="${margin}" y="32" class="title">repo-graph dependency map</text>`);
  lines.push(`<text x="${margin}" y="52" class="subtitle">View=${projected.view} · focus=${escapeXml(projected.options.focus || 'all')} · external=${projected.options.includeExternal ? 'on' : 'off'}</text>`);

  columns.forEach((column, columnIndex) => {
    const x = margin + columnIndex * (columnWidth + columnGap);
    lines.push(`<text x="${x}" y="88" class="coltitle">${escapeXml(column.title)}</text>`);
  });

  for (const edge of projected.edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    const x1 = from.x + columnWidth;
    const y1 = from.y + boxHeight / 2;
    const x2 = to.x;
    const y2 = to.y + boxHeight / 2;
    const midX = (x1 + x2) / 2;
    const edgeClass = `edge edge-${edge.confidence}`;
    const marker = edge.confidence === 'configured' ? 'url(#arrow-green)' : edge.confidence === 'inferred' ? 'url(#arrow-blue)' : 'url(#arrow-red)';

    lines.push(`<path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" class="${edgeClass}" marker-end="${marker}"/>`);
  }

  columns.forEach((column) => {
    column.items.forEach((item) => {
      const position = positions.get(item.id);
      if (!position) return;
      lines.push(`<rect class="box" x="${position.x}" y="${position.y}" width="${columnWidth}" height="${boxHeight}" fill="${fillColor(item.kind, item.scope)}" />`);
      lines.push(`<text x="${position.x + boxLabelPadding}" y="${position.y + 21}" class="label">${escapeXml(item.label)}</text>`);
    });
  });

  const legendY = height - 50;
  lines.push(`<line x1="${margin}" y1="${legendY}" x2="${margin + 30}" y2="${legendY}" class="edge edge-configured" marker-end="url(#arrow-green)"/>`);
  lines.push(`<text x="${margin + 40}" y="${legendY + 4}" class="small">configured</text>`);
  lines.push(`<line x1="${margin + 150}" y1="${legendY}" x2="${margin + 180}" y2="${legendY}" class="edge edge-inferred" marker-end="url(#arrow-blue)"/>`);
  lines.push(`<text x="${margin + 190}" y="${legendY + 4}" class="small">inferred</text>`);
  lines.push(`<line x1="${margin + 270}" y1="${legendY}" x2="${margin + 300}" y2="${legendY}" class="edge edge-unresolved" marker-end="url(#arrow-red)"/>`);
  lines.push(`<text x="${margin + 310}" y="${legendY + 4}" class="small">unresolved</text>`);
  lines.push(`<text x="${margin}" y="${height - 20}" class="small">repos=${projected.metadata.repoCount}, dockerfiles=${projected.metadata.dockerfileCount}, dependencies=${projected.metadata.dependencyCount}</text>`);

  lines.push('</svg>');
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

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fillColor(kind: 'repo' | 'dockerfile' | 'image', scope: string): string {
  if (scope === 'external') return '#fee2e2';
  if (kind === 'repo') return '#dbeafe';
  if (kind === 'dockerfile') return '#dcfce7';
  return '#fef3c7';
}
