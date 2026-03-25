import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildGraph } from '../src/graph.js';
import { projectGraph } from '../src/project.js';

const fixtureConfigPath = path.join(process.cwd(), 'test/fixtures/repos.test.yaml');
const graph = buildGraph(loadConfig(fixtureConfigPath));

test('repo view collapses dependencies to repo and external image nodes', () => {
  const projected = projectGraph(graph, { view: 'repo' });
  assert.equal(projected.view, 'repo');
  assert.ok(projected.nodes.some((node) => node.label === 'baseimages' && node.kind === 'repo'));
  assert.ok(projected.nodes.some((node) => node.label === 'node:20-alpine' && node.scope === 'external'));
  assert.ok(projected.edges.some((edge) => edge.from === 'service-a' && edge.to === 'baseimages'));
});

test('focus and depth limit the projected neighborhood', () => {
  const projected = projectGraph(graph, { view: 'repo', focus: 'baseimages', depth: 1, excludeExternal: true });
  const labels = projected.nodes.map((node) => node.label).sort();
  assert.deepEqual(labels, ['baseimages', 'monorepo', 'service-a', 'service-b']);
  assert.ok(projected.edges.every((edge) => edge.to === 'baseimages' || edge.from === 'baseimages'));
});

test('exclude-external removes unresolved external image targets', () => {
  const projected = projectGraph(graph, { view: 'dockerfile', excludeExternal: true });
  assert.ok(projected.nodes.every((node) => node.scope === 'internal'));
  assert.ok(projected.edges.every((edge) => edge.internal));
});

test('image view prefers declared image names when present', () => {
  const projected = projectGraph(graph, { view: 'image' });
  assert.ok(projected.nodes.some((node) => node.label === 'ghcr.io/ingeniator/base-node:18'));
  assert.ok(projected.edges.some((edge) => edge.to === 'ghcr.io/ingeniator/base-node:18'));
});
