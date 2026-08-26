# Golden flow: autonomy AUTO-004 — human override (guardrail 3)

Proved by `test/cli.test.ts` — `golden flow: autonomy AUTO-004 — override-guard with audited reason`.

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow config policy --yes --preset autonomous
```

Copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`, then:

```bash
sdd-agentic-flow autonomous-resume --override-guard=3 --reason="flaky test, verified manually"
```

## Expected result

- Override log records guardrail 3 bypass with the supplied reason.
- Latest block shows `Human override: pause=false, stop=false`.
