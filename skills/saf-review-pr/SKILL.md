---
name: saf-review-pr
description: Review one task-scoped local change or pull request against its SDD and evidence, including re-review after fixes; does not implement repairs or publish reviews.
compatibility: Requires Git and a compatible Agent Skills host.
---

# Review an SDD pull request

## When to use

Use after a task-scoped local change-review package is ready, or when the user asks to review a PR associated with one SDD task. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [engineering principles](../sdd-agentic-flow-shared/references/engineering-principles.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use to implement fixes, validate a whole feature, create a PR, or review a PR whose task scope cannot be resolved.

## Inputs

- Local change-review package or local diff context plus one task reference.
- Optional `.sdd-agentic-flow/config.yml` overrides, task SDD artifacts, diff, and available check evidence.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` when present; otherwise use canonical effective defaults, then resolve the task, base, and head context from local artifacts.
   Before judging the diff, read `../sdd-agentic-flow-shared/references/reviewability.md` for review identity, available deterministic checks, typed evidence, and prior-round resolution. Use `../sdd-agentic-flow-shared/templates/pr-review.template.md` for the returned ledger.
2. Make two independent judgments: (1) spec/correctness against the SDD package, (2) engineering fit against `../sdd-agentic-flow-shared/references/engineering-principles.md` and repo conventions. Pretty code must not hide a spec miss. A spec-correct but over-engineered change is a quality finding, not an automatic block. Review acceptance criteria, changed behavior, tests, scope boundaries, and configured quality/security expectations.
3. Verify findings with code or reproducible evidence, applying `../sdd-agentic-flow-shared/references/evidence-standard.md`. The review-findings artifact is local review evidence only; do not infer a persisted product report or handoff file unless the task contract explicitly requires it. Separate blocking defects from non-blocking observations; do not invent CI results; do not invent done.
4. Produce the Markdown-first findings ledger and resolution table under `reviewability.md`, preserving IDs across rounds and distinguishing unsupported claims from confirmed defects. In autonomous mode, verified actionable findings authorize `saf-fix-pr` and re-review without a new confirmation; this Skill remains read-only.

## Safety

Operate read-only. Do not submit reviews, comments, approvals, labels, assignments, status changes, code edits, Git mutations, or network mutations by default.

## Output

Return `approved`, `changes requested`, `blocked`, or `inconclusive`, plus the scoped findings ledger, check evidence, and next step. Include `Status`, `Next recommended skill`, and `Reason`.

### Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels. Autonomy governs whether the
workflow advances after this Skill completes: verified actionable findings route to `saf-fix-pr`,
then back to review; a clean review can advance to `saf-validate`. This Skill never corrects a
finding automatically. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
