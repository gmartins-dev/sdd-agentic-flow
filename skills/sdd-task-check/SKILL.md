---
name: sdd-task-check
description: Independently check one implemented SDD task against its acceptance criteria and configured gates before handoff. Use for a task-scoped readiness check, not feature-wide validation or code changes.
metadata:
  version: 1.9.2
  pack: core
extends: sdd-implement-task
requires: [config, task-evidence]
consumes: [domain-glossary, project-context]
produces: [check-report]
baseline: [tlc-spec-driven, tdd]
compatible_with: [core, execution, full, github, local-files]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'check-report present with status PASS and every configured gate satisfied'
  blocking_conditions: [acceptance_criteria_unmet, gates_failed]
  evidence_required: [check-report]
---

# Check one SDD task

## When to use

Use after implementing one task and before commit or PR handoff. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [the TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md), [task slicing](../sdd-agentic-flow-shared/references/task-slicing.md), [artifact contracts](../sdd-agentic-flow-shared/references/artifact-contracts.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use to implement fixes, review an entire feature, approve a PR, or infer an ambiguous task identity. To validate a whole feature already integrated, use `sdd-validation` instead of repeating this process task by task.

## Inputs

- One canonical task reference.
- `.sdd/config.yml`, the task's SDD artifacts, current diff, and configured validation commands.

## Workflow

1. Read `.sdd/config.yml` first; if it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`, then resolve exactly one task.
2. Read `.sdd/context/project-context.md` and `.sdd/context/domain-glossary.md` when they exist. Map every task criterion to concrete implementation and executable evidence. Inspect changed files for scope drift and pre-existing changes.
3. Check that code tasks identify a behavior and public seam, use behavior-focused tests, record executed commands, and explain missing RED evidence.
4. Confirm the declared slice is independently verifiable, or that horizontal work and dependencies are explicitly justified.
5. Run only configured, safe, task-relevant checks, applying `../sdd-agentic-flow-shared/references/evidence-standard.md`. Record commands not run and why; never turn missing evidence into a pass.
6. Classify the task as `pass`, `needs changes`, `blocked`, or `inconclusive`, with actionable gaps.

## Safety

This is read-only except for disposable test artifacts permitted by configuration. Do not change code, specs, Git, trackers, PRs, remote services, or default configuration.

## Output

Return task identity, criterion-to-evidence summary, executed checks, scope findings, final classification, and next step. When the classification is `needs changes`, `blocked`, or `inconclusive` and resolution is likely to span a session or agent boundary, write or update `handoff.md` per `../sdd-agentic-flow-shared/references/handoff-standard.md`.

## Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in `.sdd/config.yml`). In `autonomous` mode, advancing to `sdd-create-pr` or `sdd-validation` requires a check-report with status PASS and every configured gate satisfied; an unmet acceptance criterion or failed gate blocks the advance. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
