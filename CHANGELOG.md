# Changelog

All notable changes to `repo-graph` are documented here.

The format is intentionally lightweight:

- keep unreleased notes at the top while landing changes
- cut a `## vX.Y.Z - YYYY-MM-DD` section when releasing
- link to `RELEASE_NOTES.md` if a release needs a friendlier summary

## v0.1.0 - 2026-03-26

### Added

- machine-friendly `repo-graph report --format json` output for automation/CI
- dependency hotspot summaries and common external dependency summaries in human reports
- large-graph-friendly truncation hints pointing users toward `--focus`, `--depth`, and JSON output
- install/quick-start guidance and refreshed checked-in examples
- lightweight release/changelog process documentation

### Changed

- fixture examples now include Markdown and JSON reports
- snapshot coverage now includes JSON report output
