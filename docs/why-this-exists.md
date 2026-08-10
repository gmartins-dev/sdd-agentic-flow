# Why this exists

The agent said done. The spec, the tests, and the PR still disagree. That mismatch is what this toolkit is for.

Expanded narrative: see the [README](../README.md) and [SDD methodology](sdd-methodology.md).

Coding agents can implement before understanding the request, lose task boundaries, or report completion without executable evidence. **sdd-agentic-flow** keeps the workflow local and explicit so you approve from artifacts—not from chat confidence.

| Common failure | Local response |
| --- | --- |
| Implementation starts before requirements are understood | `sdd-create-specs` and `sdd-create-prompts` |
| A task is too large for one controlled change | `sdd-implement-task` or `sdd-implement-multi` |
| Output is accepted without evidence | `sdd-task-check` and `sdd-validation` |
| A PR loses traceability to the feature | `sdd-create-pr`, `sdd-pr-review`, and `sdd-pr-fix` |
| A release ships without version or changelog checks | `sdd-release` (on demand, after validation) |

Human review stays in charge. The toolkit does not automate Git, deployment, or publishing actions.
