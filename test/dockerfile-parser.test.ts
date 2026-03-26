import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseDockerfile } from '../src/dockerfile-parser.js';
import { RepoConfig } from '../src/types.js';

function withDockerfile(content: string, run: (repo: RepoConfig, dockerfilePath: string) => void): void {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-graph-dockerfile-'));
  const dockerfilePath = path.join(tempRoot, 'Dockerfile');
  fs.writeFileSync(dockerfilePath, content);
  run({ name: 'sample', path: tempRoot }, dockerfilePath);
}

test('parseDockerfile handles ARG before FROM, --platform, and stage aliases', () => {
  withDockerfile(
    [
      'ARG BASE=node:20-alpine',
      'FROM --platform=$BUILDPLATFORM ${BASE} AS base',
      'RUN echo hi',
      'FROM base AS runtime',
    ].join('\n'),
    (repo, dockerfilePath) => {
      const parsed = parseDockerfile(repo, dockerfilePath);
      assert.equal(parsed.dependencies.length, 1);
      assert.equal(parsed.dependencies[0].resolved, 'node:20-alpine');
      assert.equal(parsed.dependencies[0].sourceLine, 2);
      assert.deepEqual(parsed.warnings, []);
    },
  );
});

test('parseDockerfile resolves default substitutions when available and keeps unknowns unresolved', () => {
  withDockerfile(
    ['ARG REGISTRY', 'FROM ${REGISTRY:-ghcr.io}/team/app:${TAG:-latest}'].join('\n'),
    (repo, dockerfilePath) => {
      const parsed = parseDockerfile(repo, dockerfilePath);
      assert.equal(parsed.dependencies.length, 1);
      assert.equal(parsed.dependencies[0].resolved, 'ghcr.io/team/app:latest');
      assert.equal(parsed.dependencies[0].confidence, 'inferred');
      assert.deepEqual(parsed.warnings, []);
    },
  );
});

test('parseDockerfile leaves unresolved substitutions and emits warnings', () => {
  withDockerfile(
    ['ARG REGISTRY', 'FROM ${REGISTRY}/team/app:$TAG'].join('\n'),
    (repo, dockerfilePath) => {
      const parsed = parseDockerfile(repo, dockerfilePath);
      assert.equal(parsed.dependencies.length, 1);
      assert.equal(parsed.dependencies[0].resolved, '${REGISTRY}/team/app:$TAG');
      assert.equal(parsed.dependencies[0].confidence, 'unresolved');
      assert.equal(parsed.warnings.some((warning) => warning.code === 'docker.from.unresolved_arg'), true);
    },
  );
});

test('parseDockerfile handles multiline FROM continuations', () => {
  withDockerfile(
    ['ARG REGISTRY=ghcr.io', 'FROM ${REGISTRY}/team/ \\', '  app:latest AS base', 'RUN echo hi'].join('\n'),
    (repo, dockerfilePath) => {
      const parsed = parseDockerfile(repo, dockerfilePath);
      assert.equal(parsed.dependencies.length, 1);
      assert.equal(parsed.dependencies[0].resolved, 'ghcr.io/team/ app:latest');
      assert.equal(parsed.dependencies[0].sourceLine, 2);
    },
  );
});
