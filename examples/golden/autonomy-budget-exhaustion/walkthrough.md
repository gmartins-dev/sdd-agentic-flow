# Golden flow: autonomy AUTO-005 — budget exhaustion (guardrail 6)

Illustrative fixture for recorded budget exhaustion. It does not measure a live host's resource usage.

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow config policy --yes --preset autonomous
```

Set `workflow.autonomy_budget.max_iterations: 0` in `.sdd-agentic-flow/config.yml`, copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`, then:

```bash
sdd-agentic-flow doctor --json --autonomy
```

## Expected result

- Loop state references guardrail 6 failure.
- `doctor --autonomy` surfaces the recorded blocked skill without overall `FAIL` solely from missing loop file.
