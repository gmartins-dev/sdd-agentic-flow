# v2 breaking changes

Short notes for 2.0. Historical 1.x detail stays in [CHANGELOG.md](../CHANGELOG.md).
This page is not a first-run guide.

## Removed

- CLI `migrate` (`--plan` / `--apply`). The toolkit no longer renames `.sdd/` for you.
- First-run / `--help` archaeology that led with migrate, legacy paths, or Milestone tables.
- Mixing `init --preset` with `--execution-mode` or `--autonomy-level`. Choose one style.

## Leftover `.sdd/`

If `.sdd/` exists and `.sdd-agentic-flow/` does not, rename `.sdd/` to `.sdd-agentic-flow/`
yourself. `doctor` may WARN. It does not mutate the tree.

If both directories exist, `doctor` WARNs. Do not merge them automatically.

## What did not change

- Two config axes only: `execution_mode` and `autonomy_level`. No third stored axis.
- 13 skills. No public `auto-sdd` or CLI skill loop.
- TLC/TDD `baseline_version` stays `0.7.0` unless a later release says otherwise.
- Commit, push, tag, and publish stay human on every operating preset.
- CHANGELOG 1.x headings remain the historical record.
