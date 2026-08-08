---
name: sdd-implement-multi
metadata:
  version: 0.7.0
  pack: multi-worktree
description: Plan or coordinate implementation of multiple dependency-aware SDD tasks. Use only when the user explicitly requests multi-task or feature orchestration; use sdd-implement-task for one task.
extends: sdd-create-prompts
requires: [config, spec-package]
consumes: [domain-glossary, project-context]
produces: [execution-plan]
baseline: [tlc-spec-driven, tdd]
compatible_with: [execution, full, multi-worktree]
depends_on: []
conflicts: []
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
2. Read `.sdd/context/project-context.md` and `.sdd/context/domain-glossary.md` when they exist. Resolve one feature, enumerate tasks, and build dependency waves from SDD evidence. Mark ambiguous or externally blocked tasks instead of guessing.
3. Default to a read-only plan. Before creating worktrees, delegating, or changing code, require explicit user authorization and verify isolation rules from configuration.
4. Plan each ready task as an independently verifiable vertical slice with a public seam, targeted test command, and evidence owner. Justify horizontal work explicitly.
5. Delegate or execute through `sdd-implement-task`; keep task scope, RED/GREEN evidence, and validation independent.
6. Collect results into a concise ledger and stop at blockers. Do not treat orchestration completion as feature validation or merge readiness.

## Safety

Never share a mutable worktree between concurrent tasks. Preserve existing changes and do not create branches, worktrees, commits, pushes, PRs, tracker updates, or network mutations by default.

## Output

Return feature identity, dependency waves, per-task status, blockers, evidence, and the next safe action.
