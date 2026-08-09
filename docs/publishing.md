# Publishing

Run `npm run release:check` first — it chains `npm run check`, `npm run pack:dry`,
`sdd-agentic-flow doctor --smoke`, and a version-consistency check across `package.json`, every
`skills/*/SKILL.md`, and every `presets/*.json`, stopping at the first failure. It replaces the
manual command list this section used to carry, so this doc never needs an edit on a routine
version bump again.

## Tag and GitHub release: automatic (since v1.6.0)

Once a version-bump commit reaches `main` and `.github/workflows/ci.yml` finishes successfully
on it, `.github/workflows/release.yml` runs automatically: it compares `package.json`'s version
against the latest existing `vX.Y.Z` tag, and — only if the new version is higher and
`CHANGELOG.md` has a matching `## X.Y.Z` section — creates an annotated tag, pushes it, and runs
`gh release create` with notes extracted from that changelog section. It is idempotent: pushes
to `main` that are not a version bump, or that already have a tag, do nothing. A `package.json`
bump with no matching changelog entry is skipped (with a workflow warning) rather than treated
as an accidental release.

This means the human decision point has moved from "authorize the tag/release" to "authorize the
push of the version-bump commit to `main`" — once that commit is pushed and CI is green, tag and
release follow without a second manual step. `npm publish` is not part of this workflow.

## `npm publish`: always manual

```bash
npm whoami
npm pack --dry-run
npm publish --dry-run --access public
npm publish --access public
```

Codex CLI, Claude Code, and Cursor-style workflows are manually validated — see
[agent compatibility](agent-compatibility.md) for the current, per-agent status of that
validation instead of a version number here (that table is the single source of truth for
which agent/scope combination has actually been exercised).

Review the dry-run file list before publishing. `npm publish` is always manual by the package
owner — no automation in this repository executes it, and none is planned to.
