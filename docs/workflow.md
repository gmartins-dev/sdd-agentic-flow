# Workflow

Plan → Prompt → Implement → Check → PR → Review → Fix → Validate

When the current phase is unclear, invoke `saf-route`. It recommends the next skill and points to that skill's `SKILL.md`; it does not invoke skills or change files. `saf-validate` is the terminal public verification capability.

## Where to read next

| Step | Doc |
| --- | --- |
| Full workflow with agents | [saf-skills-usage-guide.md](saf-skills-usage-guide.md) |
| Skill reference | [skills-catalog.md](skills-catalog.md) |
| How skills are invoked | [invocation-model.md](invocation-model.md) |
| Execution modes | [execution-modes.md](execution-modes.md) |
| Autonomy levels | [autonomy-levels.md](autonomy-levels.md) |
| Prompt patterns | [prompt-recipes.md](prompt-recipes.md) |

## Rules of thumb

Create specs before implementation. Implement one task at a time. Run `saf-check-task` on task evidence before accepting work. Run `saf-validate` after integration.

Use the TLC baseline for planning and the [TDD baseline](tdd-baseline.md) for code tasks. Confirm required behavior and contractual seams. Work in vertical slices. Record current sensor evidence (or an explicit gap). RED is optional and diagnostic; do not fabricate it.

Use multi-task orchestration only after explicit planning identifies independent paths and dependencies. The host may provide isolation; Git worktrees remain an optional fallback. Change-review skills extend the loop; they do not replace task checking.

Use `plan`, `guided`, `apply`, `review`, and `full` to select the level of local work. These modes preserve human approval and Git/release boundaries; see [execution modes](execution-modes.md).
