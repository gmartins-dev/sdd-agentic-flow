# v6+ compatibility promise

This document defines the compatibility boundary beginning with `6.0.0`. SAF v6 is clean-slate: historical CLI commands, aliases, persisted schemas, skill prefixes, packs, and legacy paths are foreign content, not migration inputs.

## Stable contracts

- The canonical command hierarchy and option grammar are the source plan and [commands.md](commands.md).
- JSON-capable commands use the versioned envelope and stable error codes in [machine-interface.md](machine-interface.md).
- Config and installation provenance retain their current schemas; installation intent uses strict `saf-install-intent/v2`. Missing, malformed, old, or future schemas are unsupported state and stop mutations before writes.
- Install and uninstall mutate only recognized v5 ownership records and declared managed paths. Unknown and historical paths remain untouched except ordinary same-path collision protection.
- CLI exit codes remain `0` for success/cancellation, `1` for handled usage/domain/validation failures, `130` for SIGINT, and `2` for unexpected internal failures.
- SAF remains local-first, zero-runtime-dependency, agent-neutral, and does not commit, push, merge, deploy, publish, or add telemetry automatically.

## Deliberate breaking boundary

The following are not supported in v6+: v5 `compatible_with`/`metadata.pack` contracts, the `github` and `multi-worktree` packs, installation intent v1, or remote-provider requirements in core skills. Use `packs`, `multi-task`, and a fresh v6 installation intent. Existing v5 command removals and `.sdd/` migration remain unsupported.

## What this does not promise

This contract does not promise rollback across filesystems after the apply boundary, preservation of pre-v5 state, remote registry availability, shell startup-file edits, or post-publication behavior. Human authority remains required for external upgrades and all Git or release actions.

Changes to command-data/error semantics or required fields require the next major release. Additive optional JSON fields remain compatible when they preserve the envelope, canonical tokens, and existing required behavior.
