import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildGraph } from '../src/graph.js';
import { renderJsonReport, renderMarkdownReport, renderTextReport } from '../src/report.js';
import { renderDot, renderMermaid, renderSvgRepos } from '../src/renderers.js';
import { stabilizeGraph } from '../src/stable.js';

const rootDir = process.cwd();
const fixtureConfigPath = path.join(rootDir, 'test/fixtures/repos.test.yaml');
const snapshotsDir = path.join(rootDir, 'test/__snapshots__');

function readSnapshot(name: string): string {
  return fs.readFileSync(path.join(snapshotsDir, name), 'utf8');
}

test('fixture graph JSON snapshot matches', () => {
  const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));
  const actual = `${JSON.stringify(graph, null, 2)}\n`;
  const expected = readSnapshot('fixture-graph.json');
  assert.equal(actual, expected);
});

test('fixture text report snapshot matches', () => {
  const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));
  const actual = `${renderTextReport(graph)}\n`;
  const expected = readSnapshot('fixture-report.txt');
  assert.equal(actual, expected);
});

test('fixture markdown report snapshot matches', () => {
  const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));
  const actual = `${renderMarkdownReport(graph)}\n`;
  const expected = readSnapshot('fixture-report.md');
  assert.equal(actual, expected);
});

test('fixture json report snapshot matches', () => {
  const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));
  const actual = renderJsonReport(graph);
  const expected = readSnapshot('fixture-report.json');
  assert.equal(actual, expected);
});

test('fixture mermaid snapshot matches', () => {
  const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));
  const actual = `${renderMermaid(graph)}\n`;
  const expected = readSnapshot('fixture-graph.mmd');
  assert.equal(actual, expected);
});

test('fixture dot snapshot matches', () => {
  const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));
  const actual = `${renderDot(graph)}\n`;
  const expected = readSnapshot('fixture-graph.dot');
  assert.equal(actual, expected);
});

test('fixture svgrepos snapshot matches', () => {
  const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));
  const actual = `${renderSvgRepos(graph)}\n`;
  const expected = readSnapshot('fixture-graph.svg');
  assert.equal(actual, expected);
});
