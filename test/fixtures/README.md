# Test Fixtures

Local sample repositories for exercising `repo-graph` without cloning external repos.

## Layout

- `baseimages/`
  - owns `ghcr.io/ingeniator/base-node:18`
- `service-a/`
  - depends on `ghcr.io/ingeniator/base-node:18`
  - uses a multi-stage alias (`FROM builder`) that should **not** create an image dependency
- `service-b/`
  - depends on `ghcr.io/ingeniator/base-node:18` via `ARG` substitution
- `monorepo/`
  - contains multiple services:
    - `apps/api/Dockerfile`
    - `apps/worker/Dockerfile.worker`
  - demonstrates monorepo discovery and multiple Dockerfiles

## Quick test

From the repo root:

```bash
npm run scan -- test/fixtures/repos.test.yaml --out ./output
npm run report -- ./output/graph.json
npm run render -- ./output/graph.json --format mermaid
npm run render -- ./output/graph.json --format svgrepos > ./output/dependency-graph.svg
```

## Expected behavior

- `baseimages` should be recognized as the configured owner of `ghcr.io/ingeniator/base-node:18`
- `service-a`, `service-b`, and `monorepo/apps/api` should depend on `baseimages`
- `service-a` should not produce a dependency on `builder`
- `monorepo/apps/worker/Dockerfile.worker` should show:
  - one dependency on `node:20-alpine` (likely unresolved/external)
  - one dependency on `ghcr.io/ingeniator/base-node:18`
