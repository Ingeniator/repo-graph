# Releasing repo-graph

A small release process is enough for `0.1.x`.

## Before tagging

1. Update `CHANGELOG.md`
2. Update `RELEASE_NOTES.md` if the release needs a user-facing summary
3. Run:
   ```bash
   npm run build
   npm test
   npm run fixture:generate-examples
   ```
4. Review checked-in example output changes
5. Commit release notes/examples/docs together if they changed

## Tagging

```bash
git tag v0.1.0
git push origin v0.1.0
```

## npm publish

If publishing to npm is desired:

```bash
npm publish
```

## GitHub release body

Use the highlights from `RELEASE_NOTES.md`, keep it short, and include:

- what kinds of repos were validated
- 2-4 example commands
- known limits / what is intentionally still rough in `0.1.x`

## After release

- smoke-test the installed package via `npx repo-graph --help`
- run at least one real repo-set scan
- capture surprises in `TODO.md` or a follow-up issue before they evaporate
