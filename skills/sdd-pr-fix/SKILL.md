---
name: sdd-pr-fix
metadata:
  version: 0.2.0
  pack: pr
description: Apply the smallest task-scoped fixes for verified SDD pull-request findings. Use only when the user explicitly asks to repair actionable PR findings; not for a general refactor or automatic push.
---

# Fix SDD pull-request findings

## When to use

Use for explicitly requested repairs to verified findings on one task-scoped PR. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md) and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use for unverified comments, broad cleanup, feature redesign, sibling tasks, or automatic commits and pushes.

## Inputs

- One task reference and a review report, PR findings, or user-supplied evidence.
- `.sdd/config.yml`, SDD artifacts, current diff, and configured validation commands.

## Workflow

1. Read `.sdd/config.yml` first; if it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`, then resolve one task and its permitted scope.
2. Build a findings ledger. Fix only findings with reproducible evidence; classify preferences, missing evidence, and spec drift without changing them.
3. Apply the smallest patch per actionable finding and add or update focused regression evidence.
4. Run configured targeted checks, update the ledger, and hand off to `sdd-pr-review` for focused re-review.

## Safety

Preserve unrelated changes. Stop for SDD reconciliation, sibling scope, unsafe environments, or unresolved identity. Do not commit, push, amend, post comments, update PR metadata, mutate trackers, or make network/default mutations unless explicitly authorized.

## Output

Return the findings ledger, changes and checks, unresolved items, re-review scope, and next step.
