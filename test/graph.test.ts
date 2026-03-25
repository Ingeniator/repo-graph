import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadConfig } from '../src/config.js';
import { buildGraph } from '../src/graph.js';

const fixtureConfigPath = path.join(process.cwd(), 'test/fixtures/repos.test.yaml');

test('image ownership matches normalized configured images without exact tag match', () => {
  const config = loadConfig(fixtureConfigPath);
  config.imageOwnership = {
    'ghcr.io/ingeniator/base-node': {
      repo: 'baseimages',
      dockerfile: 'Dockerfile',
      confidence: 'configured',
    },
  };

  const graph = buildGraph(config);
  const dependency = graph.repos
    .flatMap((repo) => repo.dockerfiles)
    .flatMap((dockerfile) => dockerfile.dependencies)
    .find((entry) => entry.resolved === 'ghcr.io/ingeniator/base-node:18');

  assert.ok(dependency?.ownership);
  assert.equal(dependency.ownership?.repo, 'baseimages');
  assert.match(dependency.ownership?.reason ?? '', /normalized imageOwnership/);
});

test('heuristics can infer internal ownership for services without declared produced images', () => {
  const config = loadConfig(fixtureConfigPath);
  config.repos.push({
    name: 'consumer',
    path: path.join(process.cwd(), 'test/fixtures/consumer'),
  });

  const graph = buildGraph(config);
  const dependency = graph.repos
    .find((repo) => repo.name === 'consumer')
    ?.dockerfiles[0]
    ?.dependencies.find((entry) => entry.resolved === 'ghcr.io/ingeniator/api:latest');

  assert.ok(dependency?.ownership);
  assert.equal(dependency?.ownership?.repo, 'monorepo');
  assert.equal(dependency?.ownership?.dockerfile, 'apps/api/Dockerfile');
  assert.equal(dependency?.ownership?.confidence, 'inferred');
});

test('ambiguous heuristic ownership remains unresolved instead of guessing', () => {
  const config = loadConfig(fixtureConfigPath);
  config.repos.push(
    {
      name: 'consumer',
      path: path.join(process.cwd(), 'test/fixtures/consumer'),
    },
    {
      name: 'api-clone',
      path: path.join(process.cwd(), 'test/fixtures/api-clone'),
    },
  );

  const graph = buildGraph(config);
  const dependency = graph.repos
    .find((repo) => repo.name === 'consumer')
    ?.dockerfiles[0]
    ?.dependencies.find((entry) => entry.resolved === 'ghcr.io/ingeniator/api:latest');

  assert.ok(dependency?.ownership);
  assert.equal(dependency?.ownership?.confidence, 'unresolved');
  assert.match(dependency?.ownership?.reason ?? '', /multiple possible internal owners/);
});
