# TODO - repo-graph

Development plan focused on making V1 trustworthy, explainable, and reliable.

## Phase 1 - Stabilize graph semantics and trust surface

- [x] Make internal vs external image representation explicit in core graph types
- [x] Make dependency target kind/scope explicit instead of inferring from loose metadata
- [x] Keep projection behavior deterministic across repo/dockerfile/image views
- [x] Add tests that lock the explicit node/edge semantics

## Phase 2 - Improve explainability in output

- [x] Add richer resolution metadata to graph JSON (`reason`, `matchedBy`, normalization details where useful)
- [x] Add scan provenance metadata (`source`, requested ref, resolved commit SHA where available)
- [x] Add clearer warnings/errors sections in reports
- [x] Make inferred vs configured ownership easier to audit in reports

## Phase 3 - Harden source acquisition

- [x] Add more clone/cache golden tests for refresh, cached reuse, tags, pinned SHAs
- [x] Improve auth/ref failure messages and edge-case handling
- [x] Validate mixed GitHub shorthand / SSH / HTTPS flows cleanly

## Phase 4 - Expand Dockerfile realism

- [x] Add more parser fixtures for real-world Dockerfile patterns
- [x] Cover multiline continuations and more substitution edge cases
- [x] Document supported vs intentionally unsupported parser behavior

## Phase 5 - Polish reporting UX

- [x] Add compact scan summary sections tuned for PRs/issues/docs
- [x] Highlight unresolved and ambiguous ownership more clearly
- [x] Add focus-specific summaries where helpful

## Current step

1. All planned phases completed in this pass. Keep examples/snapshots in sync when graph/report semantics change.
