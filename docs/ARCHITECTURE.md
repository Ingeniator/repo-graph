# Architecture

## MVP modules

- `src/config.ts` — YAML config loading
- `src/fs-utils.ts` — Dockerfile discovery
- `src/dockerfile-parser.ts` — minimal Dockerfile parsing for `ARG`, `FROM`, `AS`
- `src/graph.ts` — graph construction and ownership resolution
- `src/report.ts` — human-readable report output
- `src/renderers.ts` — Mermaid, DOT, and SVG rendering
- `src/repo-sources.ts` — local/git/GitHub repo resolution and cache management
- `src/cli.ts` — CLI entrypoint

## Notes

This scaffold intentionally keeps V1 simple:

- local paths first, before clone/cache support
- explicit config-driven ownership preferred over heuristics
- unresolved/inferred/configured states preserved in the graph
- multi-stage aliases excluded from dependency edges
