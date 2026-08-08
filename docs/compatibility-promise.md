# Compatibility promise

`sdd-agentic-flow` extends canonical engineering baselines. It never forks them.

## What changes together

- `package.json` version, every skill's `metadata.version`, and every `presets/*.json`
  `version` move together on each release.
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
`bin/version-compat.js` — not the npm `semver` package, which would break the zero-runtime-
dependency invariant (see [trust model](trust-model.md)).

## Baseline versioning

`shared/baselines/registry.yml` tracks `baseline_version` for `tlc-spec-driven` and `tdd`
independently of the package version. A baseline's stages or loop only change when its
`baseline_version` changes, and any such change is called out in [CHANGELOG.md](../CHANGELOG.md)
under a "Baseline changes" note. See [TLC integration](tlc-integration.md) for what this package
ships versus the external skills it is inspired by.

## Breaking vs. additive capability-contract changes

This section makes explicit a rule that was already implicit in prior releases.

**Breaking:**

- Removing a capability-contract field (required or optional).
- Removing a skill, or replacing one skill with another under a different name without a
  documented migration (see [upgrading](upgrading.md) for how the v0.8.0
  `sdd-reverse-engineer` → `sdd-create-specs` merge was handled as a worked example).
- Changing the semantic meaning of an existing field without changing its name — for example,
  `sdd-create-specs`'s `requires: [config, source-item]` in v0.8.0 came to cover two distinct
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
From v1.0.0 onward, this changes to a stricter stability commitment for skill contracts and
baseline versions — see the v1.0.0 release plan for the exact gate that enforces it.

## Adapters stay documentation-level

`local-files` and `github` (see [adapters](adapters.md)) do not add network calls or silent
automation. Any future adapter follows the same rule: adapters carry no methodological logic and
never weaken a baseline invariant.

## Agent neutrality

Skill bodies never name a specific coding agent or vendor (Claude, Cursor, Codex, Gemini,
Copilot); `scripts/check-skills.sh` enforces this as a regression guard over every
`skills/*/SKILL.md` body. Skills describe behavior with a small vocabulary of vendor-neutral
verbs instead — see [action vocabulary](../shared/references/action-vocabulary.md).

## What this does not promise

This is not a semantic-versioning guarantee for the CLI's argument surface or exact
`doctor`/`.sdd/config.yml` output formatting — those can change with a documented
`CHANGELOG.md` entry. It is a promise about the *shape and meaning* of skill contracts and
baseline stages, not about byte-for-byte output stability.
