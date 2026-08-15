# Golden flow: autonomy AUTO-001 — idea to spec

Proved by `test/cli.test.js` — `golden flow: autonomy AUTO-001 — brainstorm handoff to create-specs under autonomous config`.

## Commands

```bash
sdd-agentic-flow init --execution-mode full --autonomy-level autonomous
sdd-agentic-flow install planning --scope project
```

Copy converged brainstorm output and spec package from this directory into `.specs/features/quiet-hours-notifications/`, and copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`.

```bash
sdd-agentic-flow doctor --json --autonomy
```

## Expected result

- Config has `execution_mode: full` and `autonomy_level: autonomous`.
- `loop-state.md` records `saf-brainstorm` complete with `Next: saf-create-spec`.
- `doctor --autonomy` reports `autonomy_config`, `autonomy_combo`, and `autonomy_loop_state` without `FAIL`.
