# Compatibility promise

`sdd-agentic-flow` extends canonical engineering baselines. It never forks them.

## What changes together

- `package.json` version, every skill's `metadata.version`, and every `presets/*.json`
  `version` move together on each release.
- A skill's capability contract (`extends`, `requires`, `consumes`, `produces`, `baseline`,
  `compatible_with`) only changes on a minor or major release. Patch releases never change a
  contract.
- `compatible_with` is mechanically derived from `presets/*.json` membership by
  `scripts/check-skills.sh`; it cannot drift from what a pack actually installs.

## Baseline versioning

`shared/baselines/registry.yml` tracks `baseline_version` for `tlc-spec-driven` and `tdd`
independently of the package version. A baseline's stages or loop only change when its
`baseline_version` changes, and any such change is called out in [CHANGELOG.md](../CHANGELOG.md)
under a "Baseline changes" note. See [TLC integration](tlc-integration.md) for what this package
ships versus the external skills it is inspired by.

## Adapters stay documentation-level

`local-files` and `github` (see [adapters](adapters.md)) do not add network calls or silent
automation. Any future adapter follows the same rule: adapters carry no methodological logic and
never weaken a baseline invariant.

## What this does not promise

This is not a semantic-versioning guarantee for the CLI's argument surface or exact
`doctor`/`.sdd/config.yml` output formatting — those can change with a documented
`CHANGELOG.md` entry. It is a promise about the *shape and meaning* of skill contracts and
baseline stages, not about byte-for-byte output stability.
