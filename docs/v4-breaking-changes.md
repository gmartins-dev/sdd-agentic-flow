# v4 breaking changes

Major release `4.0.0` — harness integrity, evidence graph, and clean reset. No migration layer.

## Artifact contract (breaking)

- `spec.md`: stable `REQ-*` requirement identifiers required.
- `tasks.md`: `Requirement anchors: REQ-*` separate from task-order `Dependencies:`.
- Task prompts must carry the same requirement anchors.
- Check reports: `Feature: <feature-slug>` plus evidence index table with freshness.
- Validation reports: same evidence table shape.

Freshness tokens: `current`, `historical`, `stale`, `not-run`.

Legacy reports without `Feature:` remain readable history but cannot satisfy v4 graph coverage.

## New CLI surfaces

```bash
sdd-agentic-flow doctor --evidence-graph <feature-slug>
sdd-agentic-flow uninstall --plan --purge
sdd-agentic-flow uninstall --apply --purge --yes
```

`--purge` is cross-scope and cannot combine with `--scope`, `--agent`, `--full`, or
`--include-config`.

## Shared references added

- `system-invariants.md`
- `task-context-package.md`
- `decision-gates.md`
- `bounded-execution.md`

## Non-changes

- No new public skills; roster unchanged.
- No runtime dependencies, scheduler, telemetry, or automatic Git mutation.
- `.specs/features/**` never removed by SAF cleanup.

See [CHANGELOG.md](../CHANGELOG.md) and [uninstall.md](uninstall.md).
