---
name: saf-create-pr
description: Prepare a task-scoped pull-request package from validated SDD evidence. Use only when the user explicitly asks to create or prepare a PR; do not use for implementation, review, or automatic publishing.
metadata:
  version: 6.0.0
extends: saf-check-task
requires: [config, task-evidence]
consumes: []
produces: [change-review-package]
baseline: [tlc-spec-driven]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'pr-description.md present, linked to complete task evidence, with no required template section missing'
  blocking_conditions: [missing_task_evidence, incomplete_pr_template]
  evidence_required: [pr-description.md]
---

# Prepare an SDD pull request

## When to use

Use after a single task passes its checks and the user explicitly requests a local change-review package. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md) and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use before task validation, for feature-wide PRs without explicit scope, to fix code, or to publish a PR by default.

## Inputs

- One validated task reference, local base/head or diff context, and task-check evidence.
- `.sdd-agentic-flow/config.yml`, SDD artifacts, current diff, and repository PR conventions.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` first; if it is missing, ask the user to run `/saf-setup` or `npx sdd-agentic-flow init`.
2. Verify scope, clean attribution of changed files, validation evidence, and known gaps. Stop on sibling work, missing evidence, or unsafe branch state.
3. Draft a Markdown change-review title and body anchored to SDD criteria, changes, validation, risks, and rollback notes.
4. Write the local package only. External publication is outside this core capability.

## Safety

Do not commit, push, create or edit PRs, assign reviewers, alter labels, or mutate trackers by default. Exclude secrets, PII, absolute paths, and unverified claims.

## Output

Return the change-review package, task scope, validation summary, and blockers. Include `Status`, `Next recommended skill`, and `Reason`. When a blocker is likely to outlive the current session or agent, write or update `handoff.md` per `../sdd-agentic-flow-shared/references/handoff-standard.md`.

### Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in `.sdd-agentic-flow/config.yml`). In `autonomous` mode, advancing to `saf-review-pr` requires pr-description.md present, linked to complete task evidence, with no required template section missing; a gap blocks the advance and returns control to the human. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
