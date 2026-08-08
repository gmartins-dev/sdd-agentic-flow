---
name: sdd-pr-review
metadata:
  version: 1.2.0
  pack: pr
description: Review one task-scoped pull request against its SDD, diff, and configured checks. Use for an evidence-based PR review; not for fixing findings or mutating PR metadata.
extends: sdd-create-pr
requires: [config, pr-reference]
consumes: []
produces: [review-findings]
baseline: [tlc-spec-driven]
compatible_with: [full, github, pr]
depends_on: []
conflicts: []
requires_cli: null
---

# Review an SDD pull request

## When to use

Use when the user asks to review a PR associated with one SDD task. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md) and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use to implement fixes, validate a whole feature, create a PR, or review a PR whose task scope cannot be resolved.

## Inputs

- PR URL/number or local branch plus one task reference.
- `.sdd/config.yml`, task SDD artifacts, diff, and available check evidence.

## Workflow

1. Read `.sdd/config.yml` first; if it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`, then resolve the task, base, and head context.
2. Review acceptance criteria, changed behavior, tests, scope boundaries, and configured quality/security expectations.
3. Verify findings with code or reproducible evidence. Separate blocking defects from non-blocking observations; do not invent CI results.
4. Produce a Markdown-first findings ledger with severity, file/line, evidence, required remediation, and re-review focus.

## Safety

Operate read-only. Do not submit reviews, comments, approvals, labels, assignments, status changes, code edits, Git mutations, or network mutations by default.

## Output

Return `approved`, `changes requested`, `blocked`, or `inconclusive`, plus the scoped findings ledger, check evidence, and next step.
