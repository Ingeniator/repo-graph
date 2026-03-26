import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildGraph } from '../src/graph.js';
import { renderJsonReport, renderMarkdownReport, renderTextReport } from '../src/report.js';
import { renderDot, renderMermaid, renderSvgRepos } from '../src/renderers.js';

const rootDir = process.cwd();
const fixtureConfigPath = path.join(rootDir, 'test/fixtures/repos.test.yaml');
const outputDir = path.join(rootDir, 'examples/fixture-output');

fs.mkdirSync(outputDir, { recursive: true });

const graph = buildGraph(loadConfig(fixtureConfigPath));

fs.writeFileSync(path.join(outputDir, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'report.txt'), `${renderTextReport(graph)}\n`);
fs.writeFileSync(path.join(outputDir, 'report.md'), `${renderMarkdownReport(graph)}\n`);
fs.writeFileSync(path.join(outputDir, 'report.json'), renderJsonReport(graph));
fs.writeFileSync(path.join(outputDir, 'dependency-graph.mmd'), `${renderMermaid(graph)}\n`);
fs.writeFileSync(path.join(outputDir, 'dependency-graph.dot'), `${renderDot(graph)}\n`);
fs.writeFileSync(path.join(outputDir, 'dependency-graph.svg'), `${renderSvgRepos(graph)}\n`);

console.log('Updated fixture examples in examples/fixture-output');
