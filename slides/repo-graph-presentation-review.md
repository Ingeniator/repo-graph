---
title: repo-graph
subtitle: Discovering Docker image dependencies across repositories
author: Sergei Mironov
---

# repo-graph
## Discovering Docker image dependencies across repositories

- CLI for scanning multiple repos and building a dependency graph from Dockerfiles
- Focused on practical impact analysis for teams with shared base images and many services
- Outputs for both humans and automation: reports, JSON, Mermaid, DOT, SVG

---

# The problem

Teams with many services usually have poor visibility into image relationships:

- Dockerfiles are spread across multiple repositories
- Internal images are built in one place and consumed in another
- Monorepos contain many services with different Dockerfiles
- Multi-stage builds create false positives if parsed naively
- `ARG`-based `FROM` references make dependency resolution harder

**Result:** it is hard to answer “what breaks if we change this base image?”

---

# Why this matters

Without a reliable graph, teams struggle to:

- estimate blast radius of base image changes
- standardize runtimes and base images
- detect unresolved or undocumented dependencies
- support platform migrations and security updates
- explain architecture clearly across teams

**repo-graph** turns scattered Dockerfiles into a single explainable dependency view.

---

# Product goal

V1 goal: a practical, trustworthy dependency graph for Docker-based repos and monorepos.

It should reliably:

- scan 5–10 repositories
- discover Dockerfiles automatically
- parse `ARG`, `FROM`, and `AS`
- distinguish real image dependencies from stage aliases
- resolve simple internal ownership mappings
- expose confidence levels: `configured`, `inferred`, `unresolved`

---

# How it works

## Inputs
- YAML config with local paths, GitHub repos, or git remotes
- optional explicit image ownership mappings

## Processing pipeline
1. Resolve repo sources
2. Clone/update cache if needed
3. Discover Dockerfiles
4. Parse `ARG` / `FROM` / `AS`
5. Build graph and resolve ownership
6. Generate reports and visualizations

## Outputs
- `graph.json`
- text / Markdown / JSON reports
- Mermaid / DOT / SVG graph renderings

---

# Architecture

Main modules:

- `config.ts` — YAML config loading
- `repo-sources.ts` — local/git/GitHub source resolution + cache
- `fs-utils.ts` — Dockerfile discovery
- `dockerfile-parser.ts` — Dockerfile parsing
- `graph.ts` — graph construction and ownership resolution
- `report.ts` — human-readable reports
- `renderers.ts` — Mermaid, DOT, SVG
- `cli.ts` — command entrypoint

Design choice: keep V1 narrow, explainable, and trustworthy rather than pretending to fully emulate Docker/BuildKit.

---

# Key technical choices

## Trust over false precision
Every internal mapping has a status:

- `configured`
- `inferred`
- `unresolved`

## Docker-aware parsing
The parser already handles:

- `ARG` defaults before and within stages
- `FROM --platform=...`
- `AS` aliases
- multi-stage alias reuse
- multiline `FROM`
- `${VAR}` and `${VAR:-default}` substitutions

This avoids common false positives from simplistic string matching.

---

# CLI and user experience

Typical workflow:

```bash
repo-graph scan repos.yaml --out ./output
repo-graph report ./output/graph.json
repo-graph report ./output/graph.json --format json > dependency-report.json
repo-graph render ./output/graph.json --format mermaid > dependency-graph.mmd
```

Useful analysis flags:

- `--view repo|dockerfile|image`
- `--focus <node>`
- `--depth <n>`
- `--include-external`
- `--exclude-external`
- `--refresh`

The large-graph UX is optimized with summaries first, then scoped drill-down.

---

# Current state of the project

Recent milestones delivered:

- git/GitHub/local repo source support with cache handling
- graph projection views and scan metadata
- explainable ownership metadata
- richer Markdown and JSON reports
- more realistic Dockerfile parser behavior
- SVG repo rendering
- fixture-based example outputs and snapshot tests
- release docs and rollout guidance

This is no longer just a prototype parser — it is shaping into a usable engineering tool.

---

# Example use cases

repo-graph helps answer questions like:

- Which services depend on `baseimages`?
- What does `service-a` depend on?
- Which image links are unresolved?
- Where do we still rely on external base images?
- What is the impact of changing or deprecating a shared image?

Best fit:

- platform teams
- DevEx / infra groups
- security and upgrade planning
- architecture documentation

---

# Demo flow

A simple live demo can be:

1. Show a small `repos.yaml`
2. Run `repo-graph scan`
3. Open `graph.json` and explain confidence states
4. Run `repo-graph report --view repo --focus baseimages --depth 2`
5. Show Mermaid or SVG output
6. Highlight unresolved items as actionable follow-up

**Key message:** the tool is useful because it turns dependency discovery into something concrete, reviewable, and automatable.

---

# Limitations and next steps

Not in V1:

- full Docker/BuildKit parity
- dynamic image computation from scripts or CI
- registry validation of tags/images
- automatic remediation

Natural next steps:

- parse GitHub Actions / CI pipelines
- detect base image drift across services
- estimate change impact more explicitly
- surface upgrade opportunities
- generate richer HTML/docs outputs

---

# Closing

**repo-graph** gives teams a practical way to understand Docker image dependencies across repos.

What makes it strong:

- focused scope
- trustworthy resolution states
- support for real-world Dockerfile patterns
- outputs for both people and machines

**One-line pitch:**
A lightweight CLI that turns scattered Dockerfiles into an explainable dependency graph for impact analysis and platform standardization.
