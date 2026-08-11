# Golden flow: autonomy AUTO-005 — budget exhaustion (guardrail 6)

Proved by `test/cli.test.js` — `golden flow: autonomy AUTO-005 — doctor reads budget-exhausted loop state`.

## Commands

```bash
sdd-agentic-flow init --execution-mode full --autonomy-level autonomous
```

Set `workflow.autonomy_budget.max_iterations: 0` in `.sdd-agentic-flow/config.yml`, copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`, then:

```bash
sdd-agentic-flow doctor --json --autonomy
```

## Expected result

- Loop state references guardrail 6 failure.
- `doctor --autonomy` surfaces the recorded blocked skill without overall `FAIL` solely from missing loop file.
