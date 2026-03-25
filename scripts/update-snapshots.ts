import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildGraph } from '../src/graph.js';
import { renderTextReport } from '../src/report.js';
import { renderDot, renderMermaid, renderSvgRepos } from '../src/renderers.js';
import { stabilizeGraph } from '../src/stable.js';

const rootDir = process.cwd();
const fixtureConfigPath = path.join(rootDir, 'test/fixtures/repos.test.yaml');
const snapshotsDir = path.join(rootDir, 'test/__snapshots__');

fs.mkdirSync(snapshotsDir, { recursive: true });

const graph = stabilizeGraph(buildGraph(loadConfig(fixtureConfigPath)));

fs.writeFileSync(path.join(snapshotsDir, 'fixture-graph.json'), `${JSON.stringify(graph, null, 2)}\n`);
fs.writeFileSync(path.join(snapshotsDir, 'fixture-report.txt'), `${renderTextReport(graph)}\n`);
fs.writeFileSync(path.join(snapshotsDir, 'fixture-graph.mmd'), `${renderMermaid(graph)}\n`);
fs.writeFileSync(path.join(snapshotsDir, 'fixture-graph.dot'), `${renderDot(graph)}\n`);
fs.writeFileSync(path.join(snapshotsDir, 'fixture-graph.svg'), `${renderSvgRepos(graph)}\n`);

console.log('Updated snapshots in test/__snapshots__');
