#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { buildGraph } from './graph.js';
import { renderTextReport } from './report.js';
import { renderDot, renderMermaid, renderSvgRepos } from './renderers.js';
import { resolveRepoSources } from './repo-sources.js';
import { ProjectGraphOptions } from './project.js';
import { ScanGraph } from './types.js';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'scan':
      handleScan(args);
      return;
    case 'report':
      handleReport(args);
      return;
    case 'render':
      handleRender(args);
      return;
    default:
      printHelp();
      process.exitCode = 1;
  }
}

function handleScan(args: string[]): void {
  const configPath = args[0];
  if (!configPath) {
    throw new Error('Usage: repo-graph scan <config.yaml> [--out <dir>] [--refresh] [--cache-dir <dir>]');
  }

  const outDir = getFlagValue(args, '--out') ?? './output';
  const refresh = hasFlag(args, '--refresh');
  const cacheDir = getFlagValue(args, '--cache-dir');
  const resolvedConfig = resolveRepoSources(loadConfig(configPath), { refresh, cacheDir });
  const graph = buildGraph(resolvedConfig);
  graph.metadata.configPath = path.resolve(configPath);
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.join(outDir, 'graph.json');
  fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2));
  console.log(outputPath);
}

function handleReport(args: string[]): void {
  const graphPath = args[0];
  if (!graphPath) {
    throw new Error('Usage: repo-graph report <graph.json> [--view repo|dockerfile|image] [--focus <name>] [--depth <n>] [--include-external|--exclude-external]');
  }

  const graph = readGraph(graphPath);
  console.log(renderTextReport(graph, readProjectionOptions(args)));
}

function handleRender(args: string[]): void {
  const graphPath = args[0];
  if (!graphPath) {
    throw new Error('Usage: repo-graph render <graph.json> --format <mermaid|dot|svgrepos> [--view repo|dockerfile|image] [--focus <name>] [--depth <n>] [--include-external|--exclude-external]');
  }

  const format = getFlagValue(args, '--format') ?? 'mermaid';
  const graph = readGraph(graphPath);
  const options = readProjectionOptions(args);

  if (format === 'mermaid') {
    console.log(renderMermaid(graph, options));
    return;
  }

  if (format === 'dot') {
    console.log(renderDot(graph, options));
    return;
  }

  if (format === 'svgrepos') {
    console.log(renderSvgRepos(graph, options));
    return;
  }

  throw new Error(`Unsupported format: ${format}`);
}

function readGraph(graphPath: string): ScanGraph {
  return JSON.parse(fs.readFileSync(path.resolve(graphPath), 'utf8')) as ScanGraph;
}

function readProjectionOptions(args: string[]): ProjectGraphOptions {
  const depthValue = getFlagValue(args, '--depth');
  return {
    view: (getFlagValue(args, '--view') as ProjectGraphOptions['view']) ?? 'dockerfile',
    focus: getFlagValue(args, '--focus'),
    depth: depthValue ? Number(depthValue) : undefined,
    includeExternal: hasFlag(args, '--include-external'),
    excludeExternal: hasFlag(args, '--exclude-external'),
  };
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function printHelp(): void {
  console.log(`repo-graph\n\nCommands:\n  scan <config.yaml> [--out <dir>] [--refresh] [--cache-dir <dir>]\n  report <graph.json> [--view repo|dockerfile|image] [--focus <name>] [--depth <n>] [--include-external|--exclude-external]\n  render <graph.json> --format <mermaid|dot|svgrepos> [--view repo|dockerfile|image] [--focus <name>] [--depth <n>] [--include-external|--exclude-external]`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
