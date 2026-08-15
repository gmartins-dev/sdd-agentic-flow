# Troubleshooting

Symptom → likely cause → diagnostic command → fix, for every `WARN`/`FAIL` `doctor` can
emit today. The source of truth is `doctorChecks()` in `bin/sdd-agentic-flow.js`. Run `sdd-agentic-flow doctor --json`
first; it names the failing check.

## Consumer project checks

### `config`: `.sdd-agentic-flow/config.yml` not found

**Cause:** `init` was never run in this project.

**Diagnose:** `sdd-agentic-flow doctor`. Look for `WARN .sdd-agentic-flow/config.yml not found`.

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

### `skills`: "partial core skill install detected (N/5 present; missing: ...)"

**Cause:** an interrupted or manually-tampered install left some but not all of the five skills in
`CORE_SKILLS` in place. This differs from "none installed," which means `install` was never run.
Both `doctor` and the bare-invocation status screen (`npx sdd-agentic-flow`) surface this as a
`WARN`, distinct from the plain "not fully installed" message.

**Diagnose:** `sdd-agentic-flow doctor` — the message names exactly which skills are missing.

**Fix:** `sdd-agentic-flow install core` again (idempotent; fills in only what's missing).

### `project_readiness`: based on config and core skills

**Cause:** derived from `config` and `skills` above — fix those first.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** same as `config`/`skills`.

### `project_context`: `.sdd-agentic-flow/context/project-context.md` not found

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

**Cause:** `.sdd-agentic-flow/config.yml` predates feature profiles, or was hand-edited without one.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** add `workflow.feature_profile: <small_fix|medium_feature|large_feature|epic>` to
`.sdd-agentic-flow/config.yml`, or regenerate it with `init --feature-profile <profile>`.

### `evidence-first`: "quality.require_evidence_before_completion is not set to true"

**Cause:** `.sdd-agentic-flow/config.yml` was hand-edited and no longer matches the safe default.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** set `quality.require_evidence_before_completion: true` in `.sdd-agentic-flow/config.yml`.

### `language_profile`: `WARN`/`FAIL`

**Cause:** `WARN` — no `language.profile` configured (legacy config), or the profile guidance
file isn't installed yet. `FAIL` — `language.profile`/`human_outputs`/`technical_tokens`/
`bilingual_mode` don't match the expected values for a supported profile.

**Diagnose:** `sdd-agentic-flow doctor --json` — `.language` in the JSON output shows the
parsed fields and the exact message.

**Fix:** when the configured profile asset is absent because skills are not installed or are
partial, run `sdd-agentic-flow install core`. Re-run `init --language en-US` or
`init --language pt-BR` (or the `--en`/`--br` shorthands) only for a missing or invalid project
language configuration; otherwise correct the four `language.*` fields by hand to match one of
`docs/language-profiles.md`'s supported profiles.

### `safety`: "required safety defaults are missing"

**Cause:** `.sdd-agentic-flow/config.yml`'s `safety.no_commit_by_default`/`no_push_by_default`/
`no_merge_or_deploy` were hand-edited away from `true`.

**Diagnose:** `sdd-agentic-flow doctor`.

**Fix:** restore all three to `true` in `.sdd-agentic-flow/config.yml`. This package does not support
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

## `doctor --autonomy`

See [autonomy levels](autonomy-levels.md) and [autonomy guardrails](autonomy-guardrails.md) for
the full model these checks validate.

### `autonomy_config`: `WARN` "workflow.execution_mode/autonomy_level not set"

**Cause:** `.sdd-agentic-flow/config.yml` predates v1.8.0, or was hand-written without these fields.

**Diagnose:** `sdd-agentic-flow doctor --autonomy --json`.

**Fix:** none required — behavior defaults to `guided`/`manual`, identical to before v1.8.0. Add
`workflow.execution_mode`/`autonomy_level` to `.sdd-agentic-flow/config.yml` explicitly if you want a
different default, or re-run `init --execution-mode <mode> --autonomy-level <level>` against a
fresh project.

### `autonomy_combo`: `FAIL` "execution_mode=... cannot combine with autonomy_level=..."

**Cause:** `.sdd-agentic-flow/config.yml` sets `execution_mode: plan` or `execution_mode: guided` together
with `autonomy_level: autonomous` — an invalid combination (a plan-only workflow has nothing to
auto-advance into; `guided`'s entire point is step-by-step confirmation).

**Diagnose:** `sdd-agentic-flow doctor --autonomy --json`.

**Fix:** edit `.sdd-agentic-flow/config.yml` to either raise `execution_mode` to `apply`/`review`/`full`, or
lower `autonomy_level` to `manual`/`supervised`.

### `autonomy_skills`: `WARN` "skill(s) do not support autonomy_level=..."

**Cause:** the configured `autonomy_level` is `supervised` or `autonomous`, but one or more
installed skills' `autonomy_profile.supported_levels` doesn't include it — by design for skills
that always end in a human decision (`saf-brainstorm`, `saf-explain`, `saf-route`,
`saf-setup`).

**Diagnose:** `sdd-agentic-flow doctor --autonomy --json` — the message names the skill(s).

**Fix:** none required for the four skills above; this `WARN` is expected. For any other skill,
either accept it will always ask before advancing, or add a `workflow.skill_overrides` entry
pinning it explicitly.

### `autonomy_config`: `FAIL` "workflow.execution_mode/autonomy_level has an invalid value"

**Cause:** `.sdd-agentic-flow/config.yml` sets `execution_mode`/`autonomy_level` to something outside the
documented values (a typo, e.g. `autonomous2`, or a value from a different field). Unlike the
`WARN` case above, this is an explicit wrong value, not a missing one — `autonomy_combo` also
reports `FAIL` ("not evaluated") in this case rather than silently checking against
guided/manual defaults, so a real misconfiguration is never masked by a misleading `PASS`.

**Diagnose:** `sdd-agentic-flow doctor --autonomy --json`.

**Fix:** set `workflow.execution_mode` to one of `plan`/`guided`/`apply`/`review`/`full`, and
`workflow.autonomy_level` to one of `manual`/`supervised`/`autonomous`.

### `autonomy_skills`: `FAIL` "skill(s) missing autonomy_profile"

**Cause:** an installed `SKILL.md` was hand-edited and lost its `autonomy_profile` block, or was
installed from a pre-v1.8.0 package version.

**Diagnose:** `sdd-agentic-flow doctor --autonomy --json` — the message names the skill(s).

**Fix:** re-run `install <pack> --scope project`; if the file already exists, remove it first (or
use `uninstall --apply --scope project` then reinstall) so the clean version is copied back in —
same caveat as the `capability_contracts` "missing required field" entry above, since `install`
never overwrites an existing file.

### `autonomy_loop_state`: `WARN` "loop state recorded pause=true / stop=true"

**Cause:** a human (or an agent honoring an explicit stop request) set `pause: true` or
`stop: true` in `.sdd-agentic-flow/autonomy/loop-state.md` during a `supervised`/`autonomous` run.

**Diagnose:** `sdd-agentic-flow context autonomy-state`.

**Fix:** resolve whatever caused the pause/stop, then run `sdd-agentic-flow autonomous-resume`
(optionally `--override-guard=<1-7> --reason="..."` if bypassing a specific guardrail).

### `update_check`: "could not check for updates (offline or registry unreachable)"

**Cause:** `doctor --check-updates` (opt-in only — never runs automatically) couldn't reach the
npm registry within its 3-second timeout: offline, a firewall/proxy, or a genuinely down
registry. This is always `INFO`, never `WARN`/`FAIL`, and never affects `doctor`'s overall
status or exit code.

**Diagnose:** `sdd-agentic-flow doctor --check-updates --json` — the `update_check` row's
message is exactly this text on failure.

**Fix:** none needed if you're offline intentionally. Otherwise check your network/proxy and
re-run; there is no retry or background check — each invocation makes exactly one attempt.

## Output, colors, and exit codes

**Garbled or unwanted colored output:** set `NO_COLOR=1` (any value) to force plain text, or
pipe output anywhere — colors are automatically disabled whenever stdout/stderr isn't a real
terminal, so CI logs and redirected output are already plain text by default.

**Exit codes:** `0` success, `1` a handled/validation failure (bad flags, invalid input, an
overall `doctor` `FAIL`), `2` an unexpected/internal error. Scripts should treat `1` and `2`
differently only if they need to distinguish "you gave it bad input" from "something broke
internally" — both are non-zero failures.

## For package maintainers (`doctor` run inside this repository)

`package_integrity`, `private_context`, `licensing`, `presets`, `agent_compatibility`, and
`postinstall` only run when `doctor` detects it's running inside the `sdd-agentic-flow`
package itself (its own `package.json` name). These are safeguards for `npm publish`
readiness, not consumer-facing — see [publishing](publishing.md) if one of these fails before
a release.
