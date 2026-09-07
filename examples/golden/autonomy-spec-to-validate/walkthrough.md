# Golden flow: autonomy AUTO-002 — spec to validate

Illustrative check-to-validation handoff; the CLI inspects recorded state and does not execute skills.

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow config policy --yes --preset autonomous
sdd-agentic-flow install --scope project --adoption-mode team
```

Copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`.

```bash
sdd-agentic-flow doctor --json --autonomy --verbose
```

## Expected result

- Loop state shows `saf-check-task` complete with `Next: saf-validate`.
- `doctor --autonomy --verbose` lists all 7 guardrails and `autonomy_loop_state: PASS`.
