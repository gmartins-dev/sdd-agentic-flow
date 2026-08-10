---
name: sdd-implement-multi
description: Plan or coordinate implementation of multiple dependency-aware SDD tasks. Use only when the user explicitly requests multi-task or feature orchestration; use sdd-implement-task for one task.
metadata:
  version: 1.9.0
  pack: multi-worktree
extends: sdd-create-prompts
requires: [config, spec-package]
consumes: [domain-glossary, project-context]
produces: [execution-plan]
baseline: [tlc-spec-driven, tdd]
compatible_with: [execution, full, multi-worktree]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'execution-plan.md present, the task dependency graph is acyclic, and worktree/scope boundaries are declared for every delegated task'
  blocking_conditions: [circular_task_dependencies, unscoped_worktrees]
  evidence_required: [execution-plan.md]
---

# Coordinate SDD tasks

## When to use

Use when a feature has multiple explicitly selected tasks and the user asks for a dependency-aware execution plan or orchestration. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [the TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md), [task slicing](../sdd-agentic-flow-shared/references/task-slicing.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use for one task, vague feature requests, specification creation, PR work, or when dependencies and task identities cannot be resolved.

## Inputs

- One feature identifier and optional explicit task subset.
- `.sdd/config.yml`, feature SDD artifacts, and repository state.
- User-approved concurrency/worktree constraints when implementation orchestration is requested.

## Workflow

1. Read `.sdd/config.yml` first; if it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`.
2. Read `.sdd/context/project-context.md` and `.sdd/context/domain-glossary.md` when they exist. Resolve one feature, enumerate tasks, and build a candidate dependency-wave grouping from SDD evidence. Mark ambiguous or externally blocked tasks instead of guessing.
3. Before recommending that any two tasks run in parallel, analyze whether they are genuinely independent: check for files either task writes that the other also touches, shared contracts or types, shared runtime or test state, and any ordering the tasks' own evidence implies even if not stated as a formal dependency. Only place tasks in the same parallel wave when this analysis confirms real independence; when it does not, keep them sequential regardless of what the candidate grouping in step 2 suggested. This is the analysis the worktree-isolation rule in `## Safety` depends on — decide eligibility here, do not restate the rule itself.
4. Default to a read-only plan. Before creating worktrees, delegating, or changing code, require explicit user authorization and verify isolation rules from configuration.
5. Plan each ready task as an independently verifiable vertical slice with a public seam, targeted test command, and evidence owner. Justify horizontal work explicitly.
6. Delegate or execute through `sdd-implement-task`; keep task scope, RED/GREEN evidence, and validation independent.
7. Collect results into a concise ledger and stop at blockers. Do not treat orchestration completion as feature validation or merge readiness.

## Safety

Never share a mutable worktree between concurrent tasks — this is the isolation rule the dependency analysis in `## Workflow` step 3 exists to protect, and it follows `../sdd-agentic-flow-shared/references/worktree-orchestration.md`. Preserve existing changes and do not create branches, worktrees, commits, pushes, PRs, tracker updates, or network mutations by default.

## Output

Return feature identity, dependency waves, per-task status, blockers, evidence, and the next safe action. When orchestration stops at a blocker likely to span a session or agent boundary, write or update `handoff.md` per `../sdd-agentic-flow-shared/references/handoff-standard.md`, referencing the ledger rather than duplicating it.

## Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in `.sdd/config.yml`). In `autonomous` mode, advancing to delegated `sdd-implement-task` runs requires execution-plan.md present, an acyclic dependency graph, and a declared worktree/scope boundary per task; a circular dependency or unscoped worktree blocks the advance. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
