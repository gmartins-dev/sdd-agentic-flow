# TLC baseline

Baseline version: 0.6.0

This package adapts a minimum methodology from `tlc-spec-driven`.
See `NOTICE` and `LICENSING.md` for attribution and licensing.

## Minimum flow

Use **Specify → Discuss → Design → Tasks → Execute → Verify**. Clarify ambiguity
before execution, keep requirements traceable to acceptance criteria, derive tests
from those criteria, and preserve evidence before completion.

## Internal implementation

`sdd-create-specs` owns Specify through Tasks. `sdd-implement-task` and
`sdd-implement-multi` implement the Execute intent. `sdd-task-check` and
`sdd-validation` implement Verify. Direct TLC Execute is not invoked.

## Extensions

The flow may impose stricter safety or review constraints, but must not weaken this
baseline. Atomic, reviewable increments are required; commits remain manual unless
the consumer explicitly changes its policy.

## Invariants

- Do not invent requirements or silently resolve material drift.
- Stop and report `Blocked` when evidence or authority is missing.
- Use RED → GREEN → REFACTOR for implementation work.
- Do not claim completion without runnable or inspectable evidence.
