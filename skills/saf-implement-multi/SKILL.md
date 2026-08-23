---
name: saf-implement-multi
description: Implement multiple SDD tasks using dependency-aware waves and isolated mutable ownership when safe and authorized. Use for multi-task implementation; use saf-implement for exactly one task.
metadata:
  version: 6.4.2
extends: saf-create-prompts
requires: [config, spec-package]
consumes: [domain-glossary, project-context]
produces: [execution-plan, multi-task-evidence]
baseline: [tlc-spec-driven, tdd]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'execution-plan.md and multi-task evidence are present, the task dependency graph is acyclic, and every next-wave dependency and isolation boundary is satisfied'
  blocking_conditions: [circular_task_dependencies, missing_isolation_boundary]
  evidence_required: [execution-plan.md]
---

# Implement multiple SDD tasks

## When to use

Use when a feature has multiple explicitly selected tasks that must be planned and implemented as dependency-aware waves. Use `saf-implement` for exactly one task.
Read the [TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md),
[TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md),
[engineering principles](../sdd-agentic-flow-shared/references/engineering-principles.md),
[handoff standard](../sdd-agentic-flow-shared/references/handoff-standard.md),
[task slicing](../sdd-agentic-flow-shared/references/task-slicing.md), and
[workflow safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md) before acting.

## When not to use

Do not use for one task, vague feature requests, specification creation, PR work, or when dependencies, task identities, or authorization cannot be resolved.

## Inputs

- One feature identifier and optional explicit task subset.
- `.sdd-agentic-flow/config.yml`, feature SDD artifacts, and repository state.
- User-approved concurrency and isolation constraints when implementation orchestration is requested.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` first; if it is missing, ask the user to run `/saf-setup` or `npx sdd-agentic-flow init`.
2. Read `.sdd-agentic-flow/context/project-context.md` and `.sdd-agentic-flow/context/domain-glossary.md` when they exist. Resolve one feature, enumerate tasks, and build a candidate dependency-wave grouping from SDD evidence. Mark ambiguous or externally blocked tasks instead of guessing. The documented chain is: tasks → dependencies → **DAG** (must be **acyclic**) → **waves** → isolated concurrent work only with explicit user authorization. In autonomous mode, the original bounded delegation supplies local authorization for sequential completion; parallel work still requires a valid isolation boundary and host capability. See `../sdd-agentic-flow-shared/references/execution-isolation.md`. Do not add a runtime scheduler.
3. Before recommending parallel work, analyze mutable paths, shared contracts/types, runtime/test state, and evidence ordering. Keep tasks sequential unless real independence and an isolation boundary are established. DAG-unblocked is not parallel-admissible by itself: require isolated mutable ownership, no conflicting shared contract mutation, compatible runtime/test state, and independently attributable evidence; otherwise use the existing sequential fallback.
4. Write `execution-plan.md` with waves, ownership, paths, sensors, and integration boundary. In `plan`/`guided` mode stop before mutations. In `apply`/`full`, require explicit authorization before creating an isolated workspace or changing code.
5. Plan each ready task as an independently verifiable vertical slice with a contractual seam (field label: `Public seam`), targeted sensor command, and evidence owner. Justify horizontal work explicitly. Expected RED is a diagnostic sensor hint (`n/a — not used as proof` is valid); do not instruct faking RED.
6. Execute every ready wave through `saf-implement`, once per task. Prefer host isolation when authorized and available, or execute sequentially. Lack of parallelism must not block completion. Run `saf-check-task` for each completed task before allowing dependent work to proceed. After each wave barrier: collect task evidence, evaluate completion criteria and semantic progress, re-check affected stale evidence, classify decision gates, and unlock only legitimate dependent work. Record per-task ownership, isolation boundary, state (`implemented-isolated` before integration, then `integrated` only after authorized integration), check evidence, freshness, integration requirement, blocker/gate, and next admissible action. A recoverable blocker routes to its owning repair path; an authority or no-progress blocker returns control. Do not treat orchestration completion as feature validation or merge readiness.
7. Collect `multi-task-evidence` summarizing the ledger. Stop at blockers.

## Safety

Never share mutable state between concurrent tasks. Never create branches or worktrees without explicit authorization. Never commit, merge, cherry-pick, push, delete a worktree, or discard uncommitted changes implicitly. Preserve existing changes and stop on unknown mutable workspace state.

## Output

Return feature identity, dependency waves, per-task status, blockers, execution-plan and multi-task-evidence paths, integration state, and next safe action. Include `Status`, `Next recommended skill`, and `Reason`.

### Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in `.sdd-agentic-flow/config.yml`). In `autonomous` mode, advancing to delegated `saf-implement` runs requires execution-plan.md present, an acyclic dependency graph, and a declared isolation/scope boundary per task. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
