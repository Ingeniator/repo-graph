# repo-graph report

- Generated: 2026-03-26T20:43:06.323Z
- View: dockerfile
- External images: included

## Summary

- Scope: full graph
- Ownership: 4 configured, 0 inferred, 2 unresolved
- Diagnostics: 0 warnings, 0 source errors
- Projection: 6 nodes, 6 edges (4 internal, 2 external)

## Scan metadata

- Repos: 4
- Dockerfiles: 5
- Dependencies: 6
- Internal edges: 4
- External edges: 2
- Unresolved images: 1
- Warnings: 2
- Dockerfile patterns: Dockerfile, Dockerfile.*

## Dependency hotspots

- `baseimages/Dockerfile` — dockerfile/internal, 4 dependent edge(s)
- `node:20-alpine` — image/external, 2 dependent edge(s)

## Common external dependencies

- `node:20-alpine` — 2 dependent edge(s)

## Repo provenance

- **baseimages**: none
- **monorepo**: none
- **service-a**: none
- **service-b**: none

## Warnings

- none

## Source diagnostics

- none

## Ownership audit

- `baseimages/Dockerfile` → `node:20-alpine` — **unresolved** via `unmatched` (no configured or inferred owner found)
- `monorepo/apps/api/Dockerfile` → `baseimages/Dockerfile` — **configured** via `config.exact` (matched via imageOwnership config)
- `monorepo/apps/worker/Dockerfile.worker` → `baseimages/Dockerfile` — **configured** via `config.exact` (matched via imageOwnership config)
- `monorepo/apps/worker/Dockerfile.worker` → `node:20-alpine` — **unresolved** via `unmatched` (no configured or inferred owner found)
- `service-a/Dockerfile` → `baseimages/Dockerfile` — **configured** via `config.exact` (matched via imageOwnership config)
- `service-b/Dockerfile` → `baseimages/Dockerfile` — **configured** via `config.exact` (matched via imageOwnership config)

## Nodes

- `baseimages/Dockerfile` — dockerfile/internal
- `monorepo/apps/api/Dockerfile` — dockerfile/internal
- `monorepo/apps/worker/Dockerfile.worker` — dockerfile/internal
- `node:20-alpine` — image/external
- `service-a/Dockerfile` — dockerfile/internal
- `service-b/Dockerfile` — dockerfile/internal

## Edges

- `baseimages/Dockerfile` → `node:20-alpine` — **unresolved** (raw: `node:20-alpine`, explain: `unmatched; no configured or inferred owner found`)
- `monorepo/apps/api/Dockerfile` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`, explain: `config.exact; matched via imageOwnership config`)
- `monorepo/apps/worker/Dockerfile.worker` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`, explain: `config.exact; matched via imageOwnership config`)
- `monorepo/apps/worker/Dockerfile.worker` → `node:20-alpine` — **unresolved** (raw: `node:20-alpine`, explain: `unmatched; no configured or inferred owner found`)
- `service-a/Dockerfile` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`, explain: `config.exact; matched via imageOwnership config`)
- `service-b/Dockerfile` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`, explain: `config.exact; matched via imageOwnership config`)

## Unresolved image ownership

- `node:20-alpine`
