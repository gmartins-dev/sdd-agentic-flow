# Golden flow: autonomy AUTO-003 — guardrail pause → resume

Illustrative pause/resume fixture. Related executable CLI cases are in `scripts/cli-exhaustive.ts`.

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow config policy --yes --preset autonomous
```

Copy `loop-state.md` to `.sdd-agentic-flow/autonomy/loop-state.md`, then:

```bash
sdd-agentic-flow autonomous-resume
```

## Expected result

- Resume clears `pause=true` on the latest `## Current State` block.
- stdout reports the recorded next skill (`saf-check-task`).
