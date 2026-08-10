# Publishing

Run `npm run release:check` first. It chains `npm run check`, `npm run pack:dry`,
`sdd-agentic-flow doctor --smoke`, and a version-consistency check across `package.json`, every
`skills/*/SKILL.md`, and every `presets/*.json`, stopping at the first failure. It replaces the
manual command list this section used to carry, so this doc never needs an edit on a routine
version bump again.

## Tag and GitHub release: automatic (since v1.6.0)

Once a version-bump commit reaches `main` and `.github/workflows/ci.yml` finishes successfully
on it, `.github/workflows/release.yml` runs automatically: it compares `package.json`'s version
against the latest existing `vX.Y.Z` tag, and, only if the new version is higher and
`CHANGELOG.md` has a matching `## X.Y.Z` section, creates an annotated tag, pushes it, and runs
`gh release create` with notes extracted from that changelog section. It is idempotent: pushes
to `main` that are not a version bump, or that already have a tag, do nothing. A `package.json`
bump with no matching changelog entry is skipped (with a workflow warning) rather than treated
as an accidental release.

This means the human decision point has moved from "authorize the tag/release" to "authorize the
push of the version-bump commit to `main`." Once that commit is pushed and CI is green, tag and
release follow without a second manual step. `npm publish` is not part of this workflow.

## `npm publish`: automatic via npm Trusted Publishing (OIDC)

`.github/workflows/release.yml` publishes to npm itself, in the same job, right after it creates
the tag and GitHub release. Publishing happens in-process rather than via a second,
event-triggered workflow. That was a deliberate fix after the first real attempt (v1.6.1) used a
separate workflow listening for `release: published`, which GitHub never fires for a release
created by another workflow's own `GITHUB_TOKEN` (the same recursion-prevention rule that also
stops a tag push from re-triggering `ci.yml`), so it silently never ran.

It authenticates using npm's **Trusted Publishing**: `id-token: write` lets the job exchange its
GitHub Actions OIDC identity for a short-lived npm publish token. **No `NPM_TOKEN` secret is
stored in this repository.** npm only accepts that exchange from the one provider (owner/repo/
workflow filename) registered as this package's Trusted Publisher. npmjs.com allows exactly one
per package, so only `release.yml` is registered; see "One-time setup" below.

Before publishing, `release.yml` re-installs dependencies and re-runs `npm run pack:dry` as a
final sanity check of the package contents.

### One-time setup (manual, npmjs.com — cannot be automated from this repository)

1. Sign in at [npmjs.com](https://www.npmjs.com) and open the
   [`sdd-agentic-flow` package page](https://www.npmjs.com/package/sdd-agentic-flow).
2. Go to **Settings → Publishing access → Trusted Publisher** (or **Add GitHub Actions
   provider**).
3. Fill in:
   - **Organization or user:** `gmartins-dev`
   - **Repository:** `sdd-agentic-flow`
   - **Workflow filename:** `release.yml`. This is the only workflow in this repository that
     runs `npm publish`; npmjs.com allows only one Trusted Publisher per package
   - **Allowed actions:** the publish action only
   - **Environment:** leave blank (the workflow doesn't use a GitHub Environment)
4. Save. No token, secret, or further repository change is needed. The workflow already
   requests `id-token: write` and contains no credentials.

Until this is registered, the automated pipeline's `npm publish` step fails cleanly (OIDC
exchange rejected). It never falls back to any other credential, so a release created before
this setup is done simply does not publish, safely; the tag and GitHub release still succeed.

### Manual fallback

```bash
npm whoami
npm pack --dry-run
npm publish --dry-run --access public
npm publish --access public
```

Codex CLI, Claude Code, and Cursor-style workflows are manually validated. See
[agent compatibility](agent-compatibility.md) for the current, per-agent status of that
validation instead of a version number here (that table is the single source of truth for
which agent/scope combination has actually been exercised).

Review the dry-run file list before publishing manually.
