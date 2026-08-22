# Golden flow: autonomy AUTO-002 — spec to validate

Proved by `test/cli.test.ts` — `golden flow: autonomy AUTO-002 — task-check hands off to validation`.

## Commands

```bash
sdd-agentic-flow init --execution-mode full --autonomy-level autonomous
sdd-agentic-flow install full --scope project
```

Copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`.

```bash
sdd-agentic-flow doctor --json --autonomy --verbose
```

## Expected result

- Loop state shows `saf-check-task` complete with `Next: saf-validate`.
- `doctor --autonomy --verbose` lists all 7 guardrails and `autonomy_loop_state: PASS`.
