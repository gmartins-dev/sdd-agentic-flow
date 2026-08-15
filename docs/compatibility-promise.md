# Compatibility promise

This document is the **v2 contract**. `sdd-agentic-flow` extends canonical engineering
baselines. It never forks them. Breaking capability-contract changes require a major
release. Historical 1.x notes stay in [CHANGELOG.md](../CHANGELOG.md).

## What changes together

- `package.json` version is the single source of truth. Every skill's `metadata.version`
  and every `presets/*.json` `version` are stamped from it (`npm run version:stamp`) and
  must match on each release. The CLI reads `package.json` at runtime and must not
  hardcode a `VERSION` constant.
- A skill's capability contract (`extends`, `requires`, `consumes`, `produces`, `baseline`,
  `compatible_with`, plus the optional `depends_on`/`conflicts`/`requires_cli`) only changes on
  a minor or major release. Patch releases never change a contract.
- `compatible_with` is mechanically derived from `presets/*.json` membership by
  `scripts/check-skills.sh`; it cannot drift from what a pack actually installs.
- `doctor --contracts` mechanically re-validates the same contract fields against a **consumer**
  repository's installed `.agents/skills/*/SKILL.md` files, so drift or hand-edits after
  `install` are caught, not just drift at the source.

## `requires_cli`

`requires_cli` (Milestone 3, v0.9.0) is a 9th optional capability-contract field, alongside
`depends_on`/`conflicts`. It declares the minimum CLI version a skill needs, as a range:
`x.y.z` (exact), `>=x.y.z`, or `^x.y.z` (same major, `>=` minor.patch). `null` means no
constraint, same convention as `extends: null`. `doctor --contracts` validates it
deterministically against the installed CLI's `VERSION` using the vendored comparator in
`bin/version-compat.js`, not the npm `semver` package, which would break the zero-runtime-
dependency invariant (see [trust model](trust-model.md)).

## `autonomy_profile` (v1.8.0)

`autonomy_profile` is a 10th capability-contract field, alongside `requires_cli`. Unlike the 9
fields above it, it is a nested block (`supported_levels`, `auto_continue_condition`,
`blocking_conditions`, `evidence_required`), not a single scalar or flow array. See
[autonomy levels](autonomy-levels.md#authoring-autonomy_profile-for-a-skill). It follows the same
breaking-vs-additive rule as every other contract field below: removing it, or changing an
existing skill's `supported_levels` in a way that drops a level a project already configured, is
a breaking change requiring a major release under the v1.0 stability commitment.
`scripts/check-skills.sh` validates every installed skill declares it and that
`supported_levels` stays a subset of `{manual, supervised, autonomous}`, the same enforcement
style as `compatible_with`.

## Baseline versioning

`shared/baselines/registry.yml` tracks `baseline_version` for `tlc-spec-driven` and `tdd`
independently of the package version. A baseline's stages or loop only change when its
`baseline_version` changes, and any such change is called out in [CHANGELOG.md](../CHANGELOG.md)
under a "Baseline changes" note. See [Baselines](baselines.md) for what this package
ships versus the external skills it is inspired by.

v1.13.0 does **not** change the baseline contract. Existing baseline remains compatible with
CLI and bundled-skills refreshes from that release; no new baseline migration is required.

v1.14.0 **does** change the condensed baseline loop. `tdd` and `tlc-spec-driven`
`baseline_version` move `0.6.0` → `0.7.0`. The TDD loop becomes
`[name-behavior, test-at-contractual-seam, implement, record-evidence]`. TLC stages are
unchanged; the TLC invariant no longer embeds RED → GREEN as proof. Field labels stay.
This is a minor Baseline change under the rule above, not a major: no skill renamed, no
capability-contract field removed. See [CHANGELOG.md](../CHANGELOG.md) **Baseline
changes**.

v1.15.0–v1.19.0 do **not** bump `baseline_version` (still `0.7.0`). Loop and stages move only
with `baseline_version`. See [CHANGELOG.md](../CHANGELOG.md).

## Breaking vs. additive capability-contract changes

This section makes explicit a rule that was already implicit in prior releases.

**Breaking:**

- Removing a capability-contract field (required or optional).
- Removing a skill, or replacing one skill with another under a different name without a
  documented migration (see [CHANGELOG.md](../CHANGELOG.md) for how the v0.8.0
  `sdd-reverse-engineer` → `saf-create-spec` merge was handled as a worked example).
- Changing the semantic meaning of an existing field without changing its name. For example,
  `saf-create-spec`'s `requires: [config, source-item]` in v0.8.0 came to cover two distinct
  modes (source-item and existing-code) under the same field name and values, which is a
  breaking semantic change even though the field's declared value list did not change.

**Additive:**

- A new optional capability-contract field (for example `requires_cli` in v0.9.0) that every
  existing skill can adopt as `null`/empty without changing behavior.
- A new CLI command or flag that does not change the meaning or default behavior of an
  existing one.
- A new skill that does not replace or rename an existing one.

**When each is allowed:** during the beta (every release before v1.0.0), breaking
capability-contract changes are permitted in a **minor** release, always documented in
[CHANGELOG.md](../CHANGELOG.md) under an explicit "Breaking capability-contract change" note.
This contract requires a **major** release for breaking capability-contract changes, the
same as the CLI argument surface and environment matrix below.

## Adapters stay documentation-level

`local-files` and `github` (see [adapters](adapters.md)) do not add network calls or silent
automation. Any future adapter follows the same rule: adapters carry no methodological logic and
never weaken a baseline invariant.

## Agent neutrality

Skill bodies never name a specific coding agent or vendor (Claude, Cursor, Codex, Gemini,
Copilot); `scripts/check-skills.sh` enforces this as a regression guard over every
`skills/*/SKILL.md` body. Skills describe behavior with a small vocabulary of vendor-neutral
verbs instead. See [action vocabulary](../shared/references/action-vocabulary.md).

## v1.0 stability commitment

Starting at v1.0.0, `sdd-agentic-flow` makes a public compatibility commitment, not just an
internal convention.

- **CLI argument surface.** The *documented* CLI surface includes every command and flag listed in
  `bin/sdd-agentic-flow.js`'s `help()` output and in `README.md`/`docs/**`, for example
  `init [--interactive] [--language ...] [--execution-mode ...] [--autonomy-level ...]
  [--local-git-exclude] [--quiet]`, `install <pack> [--scope user|project] [--agent ...] [--plan] [--quiet]`, `doctor
  [--json] [--smoke] [--contracts] [--autonomy] [--verbose] [--check-updates]`, `upgrade
  [--check|--plan|--skills-only]`, `context
  [status|refresh|autonomy-state]`, `autonomous-resume [--force] [--override-guard=<1-7>
  --reason="..."]`, `uninstall --plan | --apply [--include-config] [--full] [--scope
  user|project] [--agent ...] [--quiet]`, `discover [--force] [--quiet]`. These now follow the same
  rule as a skill's capability contract: they only change in a **minor** or **major** release,
  never a patch. Removing a command or flag, or changing what it defaults to, is a breaking
  change and requires a major release (or a documented, opt-in migration path). Adding a new
  command or flag, or a new optional value to an existing flag, is additive and allowed in a
  minor release, following the same breaking-vs-additive split already defined above for
  capability contracts.
- **Environment compatibility.** The support matrix in
  [environment-compatibility.md](environment-compatibility.md), including the OS/Node.js versions
  listed as `Required`, is now part of the formal promise. Dropping a listed OS or Node.js
  version is a compatibility-reducing change and requires a minor or major release, documented
  in `CHANGELOG.md`, never a silent patch. Expanding the matrix (adding a newly released
  Node.js version, for example) remains additive and can happen in a patch.
- **Process exit codes**, frozen since v1.0.0 and made explicit here as of v1.4.0: `0` success,
  `1` a handled/validation failure (bad flags, invalid input, an overall `doctor` `FAIL`), `2` an
  unexpected/internal error propagating out of `main()`'s top-level catch. A command failing
  with `1` where it previously exited `0`, or vice versa, is a breaking change under this
  section.
- **`--json` output shape**, also frozen. v1.4.0 adds one additive row: `doctor --check-updates
  --json` includes a new `{ name: "update_check", status, message }` entry in `checks`, present
  only when `--check-updates` is explicitly passed. Every other invocation's `--json` shape is
  unchanged. v1.8.0 adds the same kind of additive rows for `doctor --autonomy --json`
  (`autonomy_config`, `autonomy_combo`, `autonomy_skills`, `autonomy_budget`,
  `autonomy_loop_state`, and, with `--verbose`, `guardrail_1_completion` through
  `guardrail_7_human_gate`). These appear only when `--autonomy` is explicitly passed. Same
  precedent as the existing `--smoke`/`--contracts` rows.
- **What still stays free to change without notice:** the exact non-JSON, human-readable
  output text of `doctor` and other commands, and the wording of log/warning/error messages,
  including whether that text is colored (colors are disabled automatically for any non-TTY
  stream, and always when `NO_COLOR` is set; see README.md). Only *behavior* is frozen:
  process exit codes, whether a flag exists and what it accepts, and the shape of `--json`
  output. The literal prose of human-facing text is not frozen. This is the same distinction
  `doctor --json`/`doctor --contracts --json` already draw between mechanical output (covered)
  and the plain-text report (not covered).

This section replaces the pre-1.0 stance that the CLI argument surface carried no
semantic-versioning guarantee. Before v1.0.0, that was true by design, to keep the beta free to
correct mistakes (see the v0.9.0 `install --scope` default change for an example exercised
under that older, looser rule). From v1.0.0 onward, it no longer applies.

## What this does not promise

This is not a promise about exact `doctor`/`.sdd-agentic-flow/config.yml` non-JSON output formatting or
log/warning message wording. Those can still change with a documented `CHANGELOG.md` entry.
It is a promise about the *shape and meaning* of skill contracts, baseline stages, the
documented CLI argument surface, and the environment support matrix (all covered above), not
about byte-for-byte human-readable output stability.
