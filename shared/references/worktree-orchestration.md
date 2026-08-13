# Worktree orchestration

Use project-configured worktree helpers when available. Otherwise stay in read-only
planning until the user confirms a worktree strategy. Split only genuinely independent
tasks, record dependencies and path ownership, and do not switch branches or create
worktrees implicitly.

Document, do not schedule. There is no runtime orchestrator in this package.

```text
tasks
  → dependencies
  → DAG (must be acyclic)
  → waves (independent tasks in a wave)
  → parallel worktrees only with explicit user authorization
```

`sdd-implement-multi` already requires an acyclic graph and isolation. Waves group
independent tasks. Parallel worktrees are allowed only with explicit user authorization.
Do not create worktrees, switch branches, or run a “all tasks” scheduler by default.
