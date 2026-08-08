# Troubleshooting

Symptom → likely cause → diagnostic command → fix, for every `WARN`/`FAIL` `doctor` can
actually emit today (read `doctorChecks()` in `bin/sdd-agentic-flow.js` for the source of
truth — this file is checked against it, not invented). Run `sdd-agentic-flow doctor --json`
first; it names the failing check.

## Consumer project checks

### `config`: `.sdd/config.yml` not found

**Cause:** `init` was never run in this project.

**Diagnose:** `sdd-agentic-flow doctor` — look for `WARN .sdd/config.yml not found`.

**Fix:** `sdd-agentic-flow init` (or `init --interactive` to choose settings).

### `skills` / `shared_layer`: core skills or shared layer not fully installed

**Cause:** `install <pack>` was never run, or was run with `--scope user` (so nothing is in
the project's `.agents/skills/` — this is expected, not a bug, unless you intended
`--scope project`).

**Diagnose:** `sdd-agentic-flow doctor` and check the "Installation" section — it reports
separately whether a project-scope and each user-scope installation exist.

**Fix:** `sdd-agentic-flow install core` (user scope, global) or
`sdd-agentic-flow install core --scope project` (writes into this project). See
[installation scope](installation-scope.md).

### `project_readiness`: based on config and core skills

**Cause:** derived from `config` and `skills` above — fix those first.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** same as `config`/`skills`.

### `project_context`: `.sdd/context/project-context.md` not found

**Cause:** `discover` (or `init`, which calls it) was never run, or the file was manually
deleted.

**Diagnose:** `sdd-agentic-flow context status`.

**Fix:** `sdd-agentic-flow discover` (or `init`, which does this automatically for a new
project).

### `project_context`: "repository has changed since generation"

**Cause:** the project context was generated at an earlier Git revision than the one you are
on now — informational, not a failure.

**Diagnose:** `sdd-agentic-flow context status` — shows the recorded revision/branch and
today's.

**Fix:** `sdd-agentic-flow context refresh` to regenerate it at the current revision. This
rewrites the whole file — copy out any manual notes first.

### `context status`: "not a git repository"

**Cause:** you are not inside a Git repository, or Git is not installed.

**Diagnose:** `sdd-agentic-flow context status` — the `repository revision` line reads
`not a git repository`.

**Fix:** none needed — this is expected, graceful degradation, not an error. See
[trust model](trust-model.md) for the formal "Git is optional" requirement.

### `tdd-baseline` / `baseline-tlc` / `adaptive-sizing` / `traceability` / `artifact-contracts`: shared reference not found

**Cause:** the shared layer (`sdd-agentic-flow-shared`) is not installed in this project's
scope, or was partially removed.

**Diagnose:** `sdd-agentic-flow doctor` — the message names the missing file, e.g.
`shared/references/tlc-baseline.md not found`.

**Fix:** `sdd-agentic-flow install <pack>` again (idempotent; fills in only what's missing) in
the scope you're checking against.

### `adaptive-sizing`: "workflow.feature_profile not set in config"

**Cause:** `.sdd/config.yml` predates feature profiles, or was hand-edited without one.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** add `workflow.feature_profile: <small_fix|medium_feature|large_feature|epic>` to
`.sdd/config.yml`, or regenerate it with `init --feature-profile <profile>`.

### `evidence-first`: "quality.require_evidence_before_completion is not set to true"

**Cause:** `.sdd/config.yml` was hand-edited and no longer matches the safe default.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** set `quality.require_evidence_before_completion: true` in `.sdd/config.yml`.

### `language_profile`: `WARN`/`FAIL`

**Cause:** `WARN` — no `language.profile` configured (legacy config), or the profile guidance
file isn't installed yet. `FAIL` — `language.profile`/`human_outputs`/`technical_tokens`/
`bilingual_mode` don't match the expected values for a supported profile.

**Diagnose:** `sdd-agentic-flow doctor --json` — `.language` in the JSON output shows the
parsed fields and the exact message.

**Fix:** re-run `init --language en-US` or `init --language pt-BR` (or the `--en`/`--br`
shorthands) against a fresh config, or correct the four `language.*` fields by hand to match one
of `docs/language-profiles.md`'s supported profiles.

### `safety`: "required safety defaults are missing"

**Cause:** `.sdd/config.yml`'s `safety.no_commit_by_default`/`no_push_by_default`/
`no_merge_or_deploy` were hand-edited away from `true`.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** restore all three to `true` in `.sdd/config.yml`. This package does not support
disabling these defaults.

## Platform checks

### `platform_filesystem`: "Filesystem not writable"

**Cause:** the OS temp directory (`os.tmpdir()`) is not writable by the current user — a
permissions or disk-space problem outside the CLI's control.

**Diagnose:** `sdd-agentic-flow doctor` — check the "Platform" section.

**Fix:** fix filesystem permissions or free disk space; this is an environment problem, not a
package bug.

### `platform_shell` / `platform_git`

**Cause:** informational only. `platform_shell` reports what `SHELL`/`PSModulePath`/`ComSpec`
suggest; `platform_git` reports whether a `git` binary was found on `PATH`.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** none needed — neither ever reports `FAIL`. See
[environment compatibility](environment-compatibility.md).

## `doctor --contracts`

### `capability_contracts`: `WARN` "no installed skills found"

**Cause:** no skills installed under `.agents/skills` in this project (project scope) — the
check only inspects the project scope, not user-scope installations.

**Diagnose:** `sdd-agentic-flow doctor --contracts`.

**Fix:** `sdd-agentic-flow install <pack> --scope project` if you want project-local skills to
validate against; otherwise this `WARN` is expected under the default `user` scope.

### `capability_contracts`: `FAIL` "missing required field" / "SKILL.md missing or has no frontmatter"

**Cause:** an installed `SKILL.md` was hand-edited, truncated, or corrupted.

**Diagnose:** `sdd-agentic-flow doctor --contracts --json` — the message names the skill and
field.

**Fix:** re-run `install <pack> --scope project`; if the file already exists, remove it first
(or use `uninstall --apply --scope project` then reinstall) so the clean version is copied
back in.

### `capability_contracts`: `FAIL` "depends_on references unknown skill" / "conflicts references unknown skill" / "baseline references unknown baseline id"

**Cause:** a `depends_on`/`conflicts`/`baseline` entry was hand-edited to reference something
that doesn't exist among the installed skills or `shared/baselines/registry.yml`.

**Diagnose:** `sdd-agentic-flow doctor --contracts --json` — the message names the skill and
the unknown reference.

**Fix:** revert the hand-edit, or reinstall the skill (see above).

### `capability_contracts`: `FAIL` "contract cycle detected"

**Cause:** `depends_on` or `extends` fields were hand-edited into a cycle between two or more
installed skills.

**Diagnose:** `sdd-agentic-flow doctor --contracts --json` — the message lists the cycle path.

**Fix:** revert the hand-edit, or reinstall the affected skills.

### `capability_contracts`: `FAIL` "requires CLI \<range\>, installed CLI is \<version\>"

**Cause:** an installed skill declares `requires_cli` (Milestone 3, v0.9.0) with a minimum CLI
version your installed `sdd-agentic-flow` doesn't satisfy.

**Diagnose:** `sdd-agentic-flow doctor --contracts --json` — the message names the skill, the
required range, and your installed CLI version.

**Fix:** upgrade `sdd-agentic-flow` (`npx sdd-agentic-flow@latest ...`, or update your global
install), then re-run `install <pack>`.

## For package maintainers (`doctor` run inside this repository)

`package_integrity`, `private_context`, `licensing`, `presets`, `agent_compatibility`, and
`postinstall` only run when `doctor` detects it's running inside the `sdd-agentic-flow`
package itself (its own `package.json` name). These are safeguards for `npm publish`
readiness, not consumer-facing — see [publishing](publishing.md) if one of these fails before
a release.
