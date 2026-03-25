# repo-graph report

- Generated: 2026-03-25T23:08:26.599Z
- View: dockerfile
- External images: included

## Scan metadata

- Repos: 4
- Dockerfiles: 5
- Dependencies: 6
- Internal edges: 4
- External edges: 2
- Unresolved images: 1
- Warnings: 2
- Dockerfile patterns: Dockerfile, Dockerfile.*

## Nodes

- `baseimages/Dockerfile` — dockerfile/internal
- `monorepo/apps/api/Dockerfile` — dockerfile/internal
- `monorepo/apps/worker/Dockerfile.worker` — dockerfile/internal
- `node:20-alpine` — image/external
- `service-a/Dockerfile` — dockerfile/internal
- `service-b/Dockerfile` — dockerfile/internal

## Edges

- `baseimages/Dockerfile` → `node:20-alpine` — **unresolved** (raw: `node:20-alpine`)
- `monorepo/apps/api/Dockerfile` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`)
- `monorepo/apps/worker/Dockerfile.worker` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`)
- `monorepo/apps/worker/Dockerfile.worker` → `node:20-alpine` — **unresolved** (raw: `node:20-alpine`)
- `service-a/Dockerfile` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`)
- `service-b/Dockerfile` → `baseimages/Dockerfile` — **configured** (raw: `ghcr.io/ingeniator/base-node:18`)

## Source diagnostics

- none

## Unresolved image ownership

- `node:20-alpine`
