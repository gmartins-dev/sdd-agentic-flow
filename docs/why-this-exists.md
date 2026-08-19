# Why this exists

The agent said done. The spec, the tests, and the PR still disagree. That mismatch is what this toolkit is for.

Expanded narrative: see the [README](../README.md), [SDD methodology](sdd-methodology.md), [engineering model](engineering-model.md), and the [developer journey](developer-journey.md).

Coding agents can implement before understanding the request, lose task boundaries, or report completion without executable evidence. **sdd-agentic-flow** keeps the workflow local and explicit so you approve from artifacts—not from chat confidence.

The toolkit is more than a prompt pack: durable intent lives in specifications; bounded work
selects minimum sufficient context and a public capability; policy and gates constrain the
next transition; the coding-agent host executes. Current evidence supports verification, which
evaluates requirements before work can advance. Skills are the public capability layer, while
the host owns runtime execution.

| Common failure | Local response |
| --- | --- |
| Implementation starts before requirements are understood | `saf-create-spec` and `saf-create-prompts` |
| A task is too large for one controlled change | `saf-implement` or `saf-implement-multi` |
| Output is accepted without evidence | `saf-check-task` and `saf-validate` |
| A PR loses traceability to the feature | `saf-create-pr`, `saf-review-pr`, and `saf-fix-pr` |

Human review stays in charge. The toolkit does not automate Git, deployment, or publishing actions.
