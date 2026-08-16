# Uninstall

Start with a read-only plan:

```bash
sdd-agentic-flow uninstall --plan
sdd-agentic-flow uninstall --plan --verbose
```

Apply removal only after review:

```bash
sdd-agentic-flow uninstall --apply
sdd-agentic-flow uninstall --apply --include-config
sdd-agentic-flow uninstall --apply --full
sdd-agentic-flow uninstall --plan --purge
sdd-agentic-flow uninstall --apply --purge --yes
```

`--apply` removes only official skill directories under `.agents/skills` and `sdd-agentic-flow-shared`. It preserves `.specs/features`, `.sdd-agentic-flow/reports`, `.sdd-agentic-flow/snapshots`, `.sdd-agentic-flow/config.yml`, source code, and unknown paths. `--include-config` additionally removes `.sdd-agentic-flow/config.yml`; use it only when retiring the toolkit configuration. Any local edits inside an official toolkit skill directory are removed with that directory.

## v4 purge (clean reinstall)

`--purge` removes recognized current and legacy SAF state across all supported user and project
targets: official `saf-*` skills, legacy `sdd-*` / `setup-sdd-*` directories,
`sdd-agentic-flow-shared`, `.sdd-agentic-flow/` project state, user install intent, managed
local-git-exclude block, and legacy `.sdd/` only when ownership is proven. It preserves
`.specs/features/**`, source, Git history, foreign skills, and ambiguous paths. Cross-scope;
cannot combine with `--scope`, `--agent`, `--full`, or `--include-config`. Apply requires
`--yes`.

## Full reset before a clean reinstall

`--apply --full` is the complete-uninstall path for testing or re-onboarding from a blank
slate. It implies `--include-config` and additionally removes `.sdd-agentic-flow/context/project-context.md`,
`.sdd-agentic-flow/snapshots`, `.sdd-agentic-flow/reports`, and `.sdd-agentic-flow/usage.md`, all regenerable local state. **`.specs/features` is never
removed, by any flag combination**, in any scope: it holds hand-authored specs, the same
invariant as source code. If you also want those gone, delete them yourself
(`rm -rf .specs/features`). That is a deliberate, manual step the CLI will not take for you.
`--full` is `--apply`-only, same as `--include-config`; combining it with `--plan` fails, so
review with a plain `--plan` first if you want to see what a following `--apply --full` will
touch beyond it.

Add `--quiet` to any of the above to suppress the trailing "preserves ..." explanatory line.
The per-target `PLAN`/`PASS`/`WARN` action lines are unaffected.

Run `doctor` after removal to verify the remaining project state.

The default plan groups managed assets by installation target and reports totals, preserved
content, and the exact apply command. Add `--verbose` when exact removal paths are needed.

See [v4 breaking changes](v4-breaking-changes.md), [v2 breaking changes](v2-breaking-changes.md), and
[CHANGELOG.md](../CHANGELOG.md) for history.

## From the interactive menu

Running `npx sdd-agentic-flow` with no command at a real interactive terminal offers a numbered
menu after the status screen. Its uninstall entry only ever runs `uninstall --plan`, the
read-only preview above, and never `--apply`; it explains afterward how to run `--apply`
yourself. The menu is inert (never shown) under CI, pipes, scripts, or agent invocations.
