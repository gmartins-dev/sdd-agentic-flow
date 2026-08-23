---
name: saf-fix-pr
description: Apply the smallest task-scoped fixes for verified SDD pull-request findings. Use only when the user explicitly asks to repair actionable PR findings; not for a general refactor or automatic push.
metadata:
  version: 6.4.1
extends: saf-review-pr
requires: [config, review-findings]
consumes: []
produces: [fix-evidence]
baseline: [tlc-spec-driven]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'fix-evidence present and every actionable finding on the findings ledger is resolved or explicitly deferred with a reason'
  blocking_conditions: [findings_unresolved, scope_exceeded]
  evidence_required: [fix-evidence]
---

# Fix SDD pull-request findings

## When to use

Use for repairs to verified findings from one task-scoped local change review. In `manual` and
`supervised`, the user explicitly requests the repair. In `autonomous`, the original bounded
delegation is standing authorization for verified local findings only. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [engineering principles](../sdd-agentic-flow-shared/references/engineering-principles.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use for unverified comments, broad cleanup, feature redesign, sibling tasks, or automatic commits and pushes.

## Inputs

- One task reference and a review report, PR findings, or user-supplied evidence.
- `.sdd-agentic-flow/config.yml`, SDD artifacts, current diff, and configured validation commands.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` first; if it is missing, ask the user to run `/saf-setup` or `npx sdd-agentic-flow init`, then resolve one task and its permitted scope.
2. Build a findings ledger, applying `../sdd-agentic-flow-shared/references/evidence-standard.md`. Fix only findings with reproducible evidence; classify preferences, missing evidence, and spec drift without changing them. In autonomous mode, reconcile intent-preserving spec drift through `saf-create-spec` rather than editing the contract here. Do not close findings by reclassifying missing evidence as preference or by silently changing delegated intent.
3. Apply `../sdd-agentic-flow-shared/references/engineering-principles.md`. Apply the smallest patch per actionable finding and add or update focused regression evidence. No opportunistic cleanup.
4. Run configured targeted checks, update the ledger, and hand off to `saf-review-pr` for focused re-review.

## Safety

Preserve unrelated changes. Stop for SDD reconciliation, sibling scope, unsafe environments, or unresolved identity. Do not commit, push, amend, post comments, update PR metadata, mutate trackers, or make network/default mutations unless explicitly authorized.

## Output

Return the findings ledger, changes and checks, unresolved items, re-review scope, and next step. Include `Status`, `Next recommended skill`, and `Reason`. When actionable findings remain unresolved across a session or agent boundary, write or update `handoff.md` per `../sdd-agentic-flow-shared/references/handoff-standard.md`, referencing the findings ledger rather than duplicating it.

### Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels. In autonomous mode, advancing
back to `saf-review-pr` requires `fix-evidence` and every actionable finding resolved or explicitly
deferred with a reason. An unresolved authority boundary or scope violation blocks the transition;
verified local findings do not require a new human confirmation. See
`../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
