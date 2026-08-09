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

## `npm publish`: automatic via npm Trusted Publishing (OIDC)

Once `.github/workflows/release.yml` publishes the GitHub Release described above,
`.github/workflows/publish-npm.yml` runs automatically (`on: release: types: [published]`) and
runs `npm publish --access public --provenance`. It authenticates using npm's **Trusted
Publishing**: the workflow requests `id-token: write` and exchanges its GitHub Actions OIDC
identity for a short-lived npm publish token — **no `NPM_TOKEN` secret is stored in this
repository.** npm only accepts that exchange from the exact provider (owner/repo/workflow
filename) registered as a Trusted Publisher for this package on npmjs.com; see "One-time setup"
below.

Before publishing, the workflow re-verifies `package.json`'s version against the release tag and
re-runs `npm run check` and `npm run pack:dry` — defense-in-depth in case a release is ever
created manually instead of by `release.yml`, since `release.yml` already only fires after
`ci.yml` is green.

### One-time setup (manual, npmjs.com — cannot be automated from this repository)

1. Sign in at [npmjs.com](https://www.npmjs.com) and open the
   [`sdd-agentic-flow` package page](https://www.npmjs.com/package/sdd-agentic-flow).
2. Go to **Settings → Publishing access → Trusted Publisher** (or **Add GitHub Actions
   provider**).
3. Fill in:
   - **Organization or user:** `gmartins-dev`
   - **Repository:** `sdd-agentic-flow`
   - **Workflow filename:** `publish-npm.yml`
   - **Environment:** leave blank (the workflow doesn't use a GitHub Environment)
4. Save. No token, secret, or further repository change is needed — the workflow file already
   requests `id-token: write` and contains no credentials.

Until this is configured, `publish-npm.yml` will run and fail cleanly at the `npm publish` step
(OIDC exchange rejected) — it never falls back to any other credential, so a release created
before this setup is done simply does not publish, safely.

### Manual fallback

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

Review the dry-run file list before publishing manually.
