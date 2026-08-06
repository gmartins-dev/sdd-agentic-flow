# Why this exists

Coding agents can implement before understanding the request, lose task boundaries, or report completion without executable evidence. This toolkit keeps the workflow local and explicit.

| Common failure                                           | Local response                                     |
| -------------------------------------------------------- | -------------------------------------------------- |
| Implementation starts before requirements are understood | `sdd-create-specs` and `sdd-create-prompts`        |
| A task is too large for one controlled change            | `sdd-implement-task` or `sdd-implement-multi`      |
| Output is accepted without evidence                      | `sdd-task-check` and `sdd-validation`              |
| A PR loses traceability to the feature                   | `sdd-create-pr`, `sdd-pr-review`, and `sdd-pr-fix` |

The toolkit does not replace human review or automate Git, deployment, or publishing actions.
