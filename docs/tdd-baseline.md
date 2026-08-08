# TDD baseline

`sdd-agentic-flow` uses the TLC baseline for planning and specifications. The
TDD baseline governs implementation and testing work.

The baseline is inspired by and adapted from the public `tdd` skill in
`mattpocock/skills`. Attribution does not imply endorsement. That skill carries no version of
its own; the pinned upstream reference point is the repository's release tag
[`v1.2.3`](https://github.com/mattpocock/skills/releases/tag/v1.2.3) — see
[TLC integration](tlc-integration.md#upstream-version-pins) for how this pin is tracked and
updated.

## When it applies

Use the baseline when a task changes code or behavior. Documentation-only work
can mark TDD fields as `N/A — non-code task` and provide appropriate evidence.

## RED → GREEN → REFACTOR

For each vertical slice:

1. Name the behavior and expected observable result.
2. Confirm the public seam and narrowest test command.
3. Produce RED with the smallest useful failing test.
4. Make the smallest change needed for GREEN.
5. Refactor only after GREEN.
6. Record commands, results, risks, and limitations.

Tests should observe behavior through public interfaces. They should survive
internal refactors and avoid private implementation details.

## Seams and vertical slices

A public seam is the boundary where a user or caller observes behavior. Confirm
the seam before writing a test. Then work one behavior → one test → one
implementation → evidence at a time.

Do not create all tests first and all implementation later. That horizontal
approach weakens feedback and tends to couple tests to implementation shape.

## When RED is not practical

Do not claim strict TDD when RED cannot be produced. Record why, use a suitable
alternative such as a characterization or regression test, state remaining
risk, and identify a future test when appropriate.

## Evidence

Implementation and validation reports should record behavior, public seam, test
command, RED and GREEN evidence when available, refactor evidence, broader
checks, and limitations.

See the internal [TDD baseline](../shared/references/tdd-baseline.md),
[workflow](workflow.md), and [prompt recipes](prompt-recipes.md).
