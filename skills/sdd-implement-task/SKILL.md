---
name: sdd-implement-task
description: Implement exactly one validated SDD task as the smallest tested, merge-ready increment. Use for a single task reference or explicit task implementation request; not for planning a feature or coordinating several tasks.
metadata:
  version: 1.12.0
  pack: core
extends: sdd-create-prompts
requires: [config, task-identity]
consumes: [domain-glossary, project-context]
produces: [code-change+tdd-evidence]
baseline: [tlc-spec-driven, tdd]
compatible_with: [core, execution, full, github, local-files]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'tests pass, the configured linter is clean, and modified files stay within the declared task scope'
  blocking_conditions: [tests_fail, linter_errors, scope_exceeded]
  evidence_required: [tests, tdd-evidence]
---

# Implement one SDD task

## When to use

Use for one unambiguous task that is ready to implement or resume. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [the TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md), [task slicing](../sdd-agentic-flow-shared/references/task-slicing.md), [feature profiles](../sdd-agentic-flow-shared/references/feature-profiles.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md) before acting.

## When not to use

Do not use for specification authoring, several tasks, a feature-wide validation, PR review, or a task whose identity, scope, or dependencies are ambiguous.

## Inputs

- A single canonical task reference or explicit feature and task identifiers.
- Repository SDD artifacts, relevant code, and `.sdd-agentic-flow/config.yml`.
- Optional task prompt or prior handoff, treated as supporting evidence only.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` first. If it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`; otherwise use its paths, commands, and policy.
2. Read `.sdd-agentic-flow/context/project-context.md` and `.sdd-agentic-flow/context/domain-glossary.md` when they exist. Read `workflow.feature_profile` from `.sdd-agentic-flow/config.yml` and apply feature-profile guidance for evidence rigor. Resolve exactly one task from the configured SDD source. Confirm its acceptance criteria, dependencies, allowed scope, and current implementation state.
3. Inspect callers and existing patterns before editing. Stop if the work requires a spec change, sibling task, unsafe environment, or unresolved conflict.
4. Identify the behavior, public seam, test strategy, expected observable result, and narrowest test command. Stop when the seam is unclear.
5. Use one vertical slice at a time: produce RED when practical, implement the smallest change for GREEN, then refactor only after GREEN.
6. If strict TDD is impractical, apply `../sdd-agentic-flow-shared/references/evidence-standard.md` and report why, the replacement validation, remaining risk, and a follow-up test.
7. Report TDD evidence, changed files, checks, remaining risks, and the next SDD step. Do not commit, push, open a PR, or update external trackers unless the user separately asks.

## Safety

Preserve unrelated and pre-existing changes. Keep credentials, personal data, and local paths out of output. Do not mutate production, remote services, tracker state, Git history, or repository configuration by default.

## Output

Return the resolved task, outcome (`implemented`, `partial`, `blocked`, or `no changes required`), concise evidence, validation results, and recommended next step. When work pauses before a terminal outcome — session end, an agent swap, or a blocker only a human can resolve — write or update `handoff.md` per `../sdd-agentic-flow-shared/references/handoff-standard.md`.

## Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in `.sdd-agentic-flow/config.yml`). In `autonomous` mode, advancing to `sdd-task-check` requires tests passing, the configured linter clean, and modified files staying within the declared task scope; a failure or a scope violation blocks the advance and returns control to the human. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
