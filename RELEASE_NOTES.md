# Release Notes - repo-graph v0.1.0

`repo-graph` is a CLI tool for discovering Docker image dependencies across multiple repositories and rendering them as a graph.

This `0.1.0` release is intentionally pragmatic: trustworthy Dockerfile parsing, multiple graph views, useful reports, and enough source acquisition support to run on local repos or cached/cloned git sources.

## What landed for 0.1.0

### Machine-friendly reporting

- `repo-graph report <graph.json> --format json`
- structured projection output for automation/CI instead of scraping text
- includes summary counts, filters/options, provenance, hotspots, nodes, edges, and unresolved images

### Better usability on larger graphs

- text and Markdown reports now lead with dependency hotspots and common external dependencies
- detailed node/edge sections are capped for readability on bigger outputs
- capped sections point users toward `--focus`, `--depth`, and JSON output for deeper inspection

### Practical install/run guidance

- README now includes install + `npx` quick-start commands
- fixture examples now include Markdown and JSON reports in addition to raw graph/text/rendered outputs
- example regeneration docs updated to match the current CLI surface

### Lightweight release process

- added `CHANGELOG.md`
- added `docs/RELEASING.md` with a small release checklist and tagging flow
- `TODO.md` trimmed down to genuinely post-0.1 work

### Existing v0.1 core capabilities

- multiple graph views: `repo`, `dockerfile`, `image`
- focused impact analysis via `--focus` and `--depth`
- configured / inferred / unresolved ownership states
- text, Markdown, Mermaid, DOT, SVG, raw graph JSON outputs
- local path, GitHub shorthand, and git remote source resolution with cache/refresh support
- parser support for `ARG`, `FROM`, `AS`, `--platform`, multiline `FROM`, `${VAR}`, `${VAR:-default}`, and multi-stage alias handling

## Example commands

```bash
repo-graph scan repos.yaml --out ./output
repo-graph report ./output/graph.json --view repo --focus baseimages --depth 2 --exclude-external
repo-graph report ./output/graph.json --format json > dependency-report.json
repo-graph render ./output/graph.json --format mermaid > dependency-graph.mmd
```

## What this release is good for

- understanding which services depend on shared base images
- generating human-readable summaries for docs, PRs, and design discussions
- generating machine-friendly projections for scripts and CI checks
- identifying unresolved or inferred ownership that still needs explicit mapping

## Known limits

- real-world validation on larger repo sets still needs more mileage
- Dockerfile evaluation is intentionally partial, not full BuildKit parity
- no registry verification of tags/images yet
- no CI/CD pipeline parsing yet

## Immediate next steps after release

- run against several real repo sets and collect surprises
- expand fixture coverage with real-world Dockerfile edge cases
- decide whether the JSON report should grow additional automation-specific sections beyond the current projection model
- add a GitHub Actions example once real usage settles
