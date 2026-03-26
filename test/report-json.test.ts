import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildGraph } from '../src/graph.js';
import { buildJsonReport } from '../src/report.js';

const fixtureConfigPath = path.join(process.cwd(), 'test/fixtures/repos.test.yaml');
const graph = buildGraph(loadConfig(fixtureConfigPath));

test('json report exposes projection counts and hotspots for automation', () => {
  const report = buildJsonReport(graph, { view: 'repo' });

  assert.equal(report.view, 'repo');
  assert.equal(report.summary.projection.nodes, report.nodes.length);
  assert.equal(report.summary.projection.edges, report.edges.length);
  assert.ok(report.hotspots.topTargets.some((entry) => entry.label === 'baseimages'));
  assert.ok(report.hotspots.topExternalDependencies.some((entry) => entry.image === 'node:20-alpine'));
});

test('json report preserves focus options for machine consumers', () => {
  const report = buildJsonReport(graph, { view: 'repo', focus: 'baseimages', depth: 1, excludeExternal: true });

  assert.equal(report.options.focus, 'baseimages');
  assert.equal(report.options.depth, 1);
  assert.equal(report.options.includeExternal, false);
  assert.equal(report.summary.scope, 'focus=baseimages, depth=1');
  assert.ok(report.nodes.every((node) => node.scope === 'internal'));
});
