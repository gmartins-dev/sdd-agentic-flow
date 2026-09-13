# SDD skills usage guide

SAF defines workflow constraints and evidence transitions; the coding-agent
host executes the work. Install the official bundle once, initialize every Git
workspace, and configure only when built-in defaults need an override.

```bash
npx sdd-agentic-flow install
npx sdd-agentic-flow init
npx sdd-agentic-flow doctor
```

Missing `.sdd-agentic-flow/config.yml` is healthy. Skills use canonical
`apply` + `supervised` defaults, `.specs/features/`, local-file sources, and
the documented quality and safety gates. Invalid or future config fails closed.

## Workflow

```text
saf-route
→ saf-brainstorm (only for unresolved ideas)
→ saf-create-spec
→ saf-create-prompts
→ saf-implement or saf-implement-multi
→ saf-check-task per task
→ saf-create-pr → saf-review-pr → saf-fix-pr (when authorized) → re-review
→ saf-validate
```

Use `saf-route` when the next state transition is unclear. A missing semantic
artifact still blocks its consumer; missing optional config does not.
An explicit eligible task can go directly to implementation. Use `saf-explain`
for an explanation of existing work; that request does not authorize execution.

Use `saf-brainstorm` for an undefined problem, unresolved consequential product
direction, or an explicitly requested feasibility investigation. A bounded,
observable outcome may go directly to `saf-create-spec` even when ordinary
technical design remains open.

For several tasks, `saf-implement-multi` derives dependency waves and defaults
to sequential execution. Parallel work requires explicit worktree authority,
host concurrency, and non-overlapping mutable boundaries. The host creates and
manages worktrees; each created workspace receives the shared initialization
semantics before its worker starts.

Skills do not grant commit, push, merge, release, deploy, publish, credential
storage, or external-service authority. Those actions require separate explicit
authorization.

## Local review and re-review

`saf-create-pr` prepares a local package; `saf-review-pr` assesses a task's diff
and evidence; `saf-fix-pr` repairs verified findings within the authorized scope.
In autonomous mode, the original bounded delegation can authorize these local
transitions. A remote PR is not required, and review output does not publish one.

Reviews retain finding IDs across corrections and account for every earlier ID
in a resolution table. The repair step supplies evidence; re-review confirms
resolution. Missing evidence and an issue that was not reproduced remain visible,
and a deferral does not mean the issue was fixed. See the
[review protocol](../shared/references/reviewability.md).

Evidence identifies the inspected revision and distinguishes local inspection,
reproduction, and applicable official external sources. External research requires
existing permission; unavailable research is a gap. Checks must cover the named
requirements and states, not merely report a green suite. Structural corpus checks
do not certify a host's behavior. See the [evidence standard](../shared/references/evidence-standard.md).

See [installation](installation.md), [trust model](trust-model.md),
[execution modes](execution-modes.md), and [safety model](safety-model.md).
