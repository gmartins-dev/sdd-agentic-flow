# Compatibility and upgrade policy

SAF is experimental software. Major releases may replace CLI, installation,
skill, configuration, artifact, and workflow contracts.

## Current contracts

- One official bundle contains the locked 12-skill roster and shared layer.
- Skills use portable frontmatter plus `saf-skill-contract/v1` sidecars.
- Current state schemas are `saf-config/v3`, `saf-install-intent/v4`,
  `saf-install-provenance/v3`, and `saf-workspace/v1`.
- Machine schema 2 remains compatible throughout the 7.x line; additive fields
  are allowed, incompatible removal or semantic changes are not.
- SAF remains local-first, agent-neutral, and performs no automatic Git or
  remote release action.

## Clean-slate upgrade

Pre-v7 state is cleanup-only. SAF displays the exact recognized footprint and
requires explicit confirmation. Removal authority comes only from exact
historical names, canonical SAF paths, recognized markers/blocks, or validated
provenance. Unknown and future state fails closed.

Cleanup preserves `.specs/**`, source, tests, documentation, Git history,
foreign skills, credentials, and unknown entries. Partial cleanup is reentrant.
The exact canonical SAF control file may be removed only after an explicit,
bounded reset; unknown contents never authorize additional paths.

## Version boundary

Only current schemas are operational. v3 installation intent remains readable
as a previous compatible state: personal is local, Specs shared is shared, and
Team preserves its historical shared behavior until explicitly reconfigured.
Reading v3 does not rewrite it. A reviewed mutation writes v4. Future and
unknown state still blocks automatic mutation; a reviewed reset is limited to
paths owned and understood by the running CLI.
