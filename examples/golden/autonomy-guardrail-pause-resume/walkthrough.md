# Golden flow: autonomy AUTO-003 — guardrail pause → resume

Proved by `test/cli.test.ts` — `golden flow: autonomy AUTO-003 — autonomous-resume clears pause`.

## Commands

```bash
sdd-agentic-flow init --execution-mode full --autonomy-level autonomous
```

Copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`, then:

```bash
sdd-agentic-flow autonomous-resume
```

## Expected result

- Resume clears `pause=true` on the latest `## Current State` block.
- stdout reports the recorded next skill (`saf-check-task`).
