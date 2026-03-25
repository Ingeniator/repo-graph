# Fixture Output Example

These files show example output from running `repo-graph` against the local test fixture set in `test/fixtures/`.

## Source fixture

- config: `test/fixtures/repos.test.yaml`
- sample repos/services:
  - `baseimages`
  - `service-a`
  - `service-b`
  - `monorepo/apps/api`
  - `monorepo/apps/worker`

## Included outputs

- `graph.json` — raw graph data
- `report.txt` — readable text report
- `dependency-graph.mmd` — Mermaid graph
- `dependency-graph.dot` — Graphviz DOT graph
- `dependency-graph.svg` — rendered visual overview

## Preview

![Fixture dependency graph](./dependency-graph.svg)

## Regenerate

From repo root:

```bash
mkdir -p examples/fixture-output
npm run scan -- test/fixtures/repos.test.yaml --out ./examples/fixture-output
npm run report -- ./examples/fixture-output/graph.json > ./examples/fixture-output/report.txt
npm run render -- ./examples/fixture-output/graph.json --format mermaid > ./examples/fixture-output/dependency-graph.mmd
npm run render -- ./examples/fixture-output/graph.json --format dot > ./examples/fixture-output/dependency-graph.dot
```
