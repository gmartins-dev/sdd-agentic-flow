# TDD baseline

`sdd-agentic-flow` uses the TLC baseline for planning and specifications. The TDD baseline governs implementation and testing work.

The canonical rules live in [shared/references/tdd-baseline.md](../shared/references/tdd-baseline.md). Skills load that file at install time. Read this doc for when the baseline applies and how it relates to external skills.

## Upstream inspiration

The baseline adapts the public `tdd` skill in `mattpocock/skills`. Attribution does not imply endorsement. The pinned upstream reference is release tag [`v1.2.3`](https://github.com/mattpocock/skills/releases/tag/v1.2.3). See [Baselines](baselines.md) for how this pin is tracked and updated.

## When it applies

Use the baseline when a task changes code or behavior. Documentation-only work can mark TDD fields as `N/A — non-code task` and provide appropriate evidence.

## Summary

For each vertical slice: name the behavior, confirm the public seam, produce RED with the smallest useful failing test, make the smallest change for GREEN, refactor only after GREEN, and record commands, results, risks, and limitations.

Tests observe behavior through public interfaces. Work one behavior at a time; do not batch all tests then all implementation.

When RED is not practical, record why, use a suitable alternative (characterization or regression test), state remaining risk, and identify a future test when appropriate.

## Related docs

- [shared/references/tdd-baseline.md](../shared/references/tdd-baseline.md) — full baseline contract
- [workflow](workflow.md) — where TDD fits in the SDD loop
- [prompt-recipes](prompt-recipes.md) — prompt patterns for implementation tasks
