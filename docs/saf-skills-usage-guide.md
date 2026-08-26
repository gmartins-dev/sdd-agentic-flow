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
→ saf-create-pr → saf-review-pr → saf-fix-pr (when requested)
→ saf-validate
```

Use `saf-route` when the next state transition is unclear. A missing semantic
artifact still blocks its consumer; missing optional config does not.

For several tasks, `saf-implement-multi` derives dependency waves and defaults
to sequential execution. Parallel work requires explicit worktree authority,
host concurrency, and non-overlapping mutable boundaries. The host creates and
manages worktrees; each created workspace receives the shared initialization
semantics before its worker starts.

Skills do not grant commit, push, merge, release, deploy, publish, credential
storage, or external-service authority. Those actions require separate explicit
authorization.

See [installation](installation.md), [trust model](trust-model.md),
[execution modes](execution-modes.md), and [safety model](safety-model.md).
