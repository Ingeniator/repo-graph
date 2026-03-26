# TODO - repo-graph

Remaining post-0.1 work worth doing after the initial release.

## Real-world validation

- [ ] Run against 5-10 real repositories with mixed layouts
- [ ] Validate readability and focus behavior on at least one genuinely large monorepo
- [ ] Capture surprising unresolved/inferred ownership cases from real usage
- [ ] Tighten heuristics based on concrete false positives / false negatives

## Parser and source hardening

- [ ] Add more real-world Dockerfile fixture packs
- [ ] Cover additional substitution/formatting edge cases found in the wild
- [ ] Keep auth/ref/cache failure messages terse and actionable as more cases appear

## Integration polish

- [ ] Add a GitHub Actions example for scan/report workflows
- [ ] Decide how much `report --format json` should grow beyond the current projection-focused shape
- [ ] Validate npm publish/install flow from a clean machine
