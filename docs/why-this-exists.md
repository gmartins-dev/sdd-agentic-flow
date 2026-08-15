# Why this exists

The agent said done. The spec, the tests, and the PR still disagree. That mismatch is what this toolkit is for.

Expanded narrative: see the [README](../README.md), [SDD methodology](sdd-methodology.md), and the [mental model](sdd-agentic-flow-model.md) (Prompt → Context → Harness → Loop + SDD).

Coding agents can implement before understanding the request, lose task boundaries, or report completion without executable evidence. **sdd-agentic-flow** keeps the workflow local and explicit so you approve from artifacts—not from chat confidence.

The toolkit is more than a prompt pack: **prompts** tell the agent what to do; **context** (`.specs/`, `.sdd-agentic-flow/`) holds durable project state; the **harness** (modes, contracts, guardrails) bounds behavior; the **loop** (autonomy, `loop-state.md`, resume) helps multi-step work finish without losing place. **SDD** defines what “done” means up front. Skills are the **execution layer** of that harness, not the whole product — see README [`## What is sdd-agentic-flow?`](../README.md#what-is-sdd-agentic-flow).

| Common failure | Local response |
| --- | --- |
| Implementation starts before requirements are understood | `saf-create-spec` and `saf-create-prompts` |
| A task is too large for one controlled change | `saf-implement` or `saf-implement-multi` |
| Output is accepted without evidence | `saf-check-task` and `saf-validate` |
| A PR loses traceability to the feature | `saf-create-pr`, `saf-review-pr`, and `saf-fix-pr` |

Human review stays in charge. The toolkit does not automate Git, deployment, or publishing actions.
