# Workflow

Create specs before implementation, implement one Task at a time, independently check
Task evidence, and run feature validation after integration.

Use multi-worktree orchestration only after explicit planning identifies independent paths
and dependencies. PR skills are extensions; they never replace task checking.

Use the documented `plan`, `guided`, `apply`, `review`, and `full` modes to select the level
of local work. They preserve human approval and Git/release boundaries; see [execution modes](execution-modes.md).
