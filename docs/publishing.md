# Publishing

Run `npm run release:check` first. It chains `npm run check`, `npm run pack:dry`,
`sdd-agentic-flow doctor --smoke`, and a version-consistency check across `package.json`, every
`skills/*/SKILL.md`, every `packs/*.json`, and package-lock root metadata, stopping at the first failure. It replaces the
manual command list this section used to carry, so this doc never needs an edit on a routine
version bump again.

## Version bump

`package.json` `version` is the only number to edit by hand. Then:

```bash
npm run version:stamp
```

That writes the same `x.y.z` into every `skills/*/SKILL.md` `metadata.version`, every
`packs/*.json` `version` (copies that must exist on disk after `install` — agents and
`doctor --contracts` read the skill file, not this repository's `package.json`). The CLI
reads `package.json` at runtime; do not put a literal `const VERSION = 'x.y.z'` back in
`src/sdd-agentic-flow.ts` or `dist/sdd-agentic-flow.js`. It also updates only
`package-lock.json.version` and `package-lock.json.packages[""].version`, without resolving dependencies.

Add the matching `## x.y.z` section to `CHANGELOG.md`. `npm run check` / `release:check`
fail if any stamped copy drifted, and print `npm run version:stamp` as the fix. Do not
stamp `CHANGELOG.md`, `ROADMAP.md`, or narrative “vX.Y.Z+” mentions in docs — those are
history, not pins.

## Tag and GitHub release: automatic

Once a version-bump commit reaches `main` and `.github/workflows/ci.yml` finishes successfully
on it, `.github/workflows/release.yml` runs automatically: it compares `package.json`'s version
against the latest existing `vX.Y.Z` tag, and, only if the new version is higher and
`CHANGELOG.md` has a matching `## X.Y.Z` section, creates an annotated tag, pushes it, and runs
`gh release create` with notes extracted from that changelog section. It is idempotent: pushes
to `main` that are not a version bump, or that already have a tag, do nothing. A `package.json`
bump with no matching changelog entry is skipped (with a workflow warning) rather than treated
as an accidental release.

The human decision point is the push of the version-bump commit to `main`. Once that commit is pushed and CI is green, tag,
release, and both registry publishes follow without a second manual step.

## `npm publish`: automatic via npm Trusted Publishing (OIDC)

`.github/workflows/release.yml` publishes to npm itself, in the same job, right after it creates
the tag and GitHub release. Publishing happens in the same workflow rather than through a second
event-triggered workflow. This avoids relying on a `release: published` event emitted by a release
created with the workflow's own `GITHUB_TOKEN`, which does not retrigger the release pipeline.

It authenticates using npm's **Trusted Publishing**: `id-token: write` lets the job exchange its
GitHub Actions OIDC identity for a short-lived npm publish token. **No `NPM_TOKEN` secret is
stored in this repository.** npm only accepts that exchange from the one provider (owner/repo/
workflow filename) registered as this package's Trusted Publisher. npmjs.com allows exactly one
per package, so only `release.yml` is registered; see "One-time setup" below.

Before publishing, `release.yml` re-installs dependencies and re-runs `npm run pack:dry` as a
final sanity check of the package contents.

## GitHub Packages mirror: automatic (scoped)

The same `release.yml` job also publishes **`@gmartins-dev/sdd-agentic-flow`** to
[GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
(`https://npm.pkg.github.com`) after the public npm publish (or on a retry when npm already has
the version but GitHub Packages does not). That scoped name is used **only at publish time**;
the committed `package.json` name stays **`sdd-agentic-flow`** so `npx sdd-agentic-flow` keeps
working against the public npm registry.

GitHub links the scoped package to this repository via the existing `repository` field and
shows it under the repo sidebar **Packages** section. Install from GitHub Packages:

```bash
npm install @gmartins-dev/sdd-agentic-flow --registry=https://npm.pkg.github.com
```

The workflow authenticates with `GITHUB_TOKEN` (`packages: write`). No extra secret is required.
To backfill an already-tagged version manually (for example after enabling this mirror), run
`npm ci`, then:

```bash
NODE_AUTH_TOKEN=<github_pat_with_write:packages> bash scripts/publish-github-packages.sh
```

Or re-run a successful **Release** workflow after the tag exists; the GitHub Packages gate is
independent of the public npm gate.

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
