# Workflow

Use the local flow `Plan → Prompt → Implement → Check → PR → Review → Fix → Validate`. When the current phase is unclear, use `sdd-route` for a recommendation, then follow the recommended skill's `SKILL.md`.

Create specs before implementation, implement one Task at a time, independently check
Task evidence, and run feature validation after integration.

Use the TLC baseline for planning and the [TDD baseline](tdd-baseline.md) for code
tasks. Confirm behavior and public seams before tests, work in vertical slices,
and report RED/GREEN evidence or an explicit limitation.

Use multi-worktree orchestration only after explicit planning identifies independent paths
and dependencies. PR skills are extensions; they never replace task checking.

Use the documented `plan`, `guided`, `apply`, `review`, and `full` modes to select the level
of local work. They preserve human approval and Git/release boundaries; see [execution modes](execution-modes.md).
