# Compatibility and upgrade policy

SAF is experimental software. Major releases may replace CLI, installation, skill,
configuration, artifact, and workflow contracts without backward compatibility.

## Current contracts

- Skill capability contracts are defined by each `SKILL.md`; distribution membership lives only in `packs/*.json`.
- Installation packs are exactly `planning`, `execution`, `review`, `multi-task`, and `full`.
- Current state schemas are `saf-config/v2`, `saf-install-intent/v2`, and `saf-install-provenance/v2`.
- SAF remains local-first, zero-runtime-dependency, agent-neutral, and does not commit, push, merge, deploy, publish, or add telemetry automatically.

## Clean-slate upgrade

An incompatible upgrade replaces SAF-managed installation assets with the latest release
contract. It does not translate old configuration, aliases, pack IDs, or skill metadata.
Recognized older metadata may be inspected only by the cleanup-only ownership recognizer; it is
never accepted as current operational state.

The cleanup preserves repository source, Git history, `.specs/features/**`, project context,
reports, snapshots, explanations, evidence, review artifacts, and non-SAF skills. It replaces
managed SAF skills, the shared installed layer, installation intent, provenance, config, and
regenerable usage files. Unknown or future state fails closed before deletion.

`core`, `local-files`, `github`, `pr`, and `multi-worktree` are not current pack aliases.
Bare CLI invocation is read-only; installation requires an explicit install/init operation.

## Version boundary

Current state is supported. Explicitly recognized previous SAF state is cleanup-only. Future or
unknown schemas are refused, because the CLI must not delete state it cannot understand.
