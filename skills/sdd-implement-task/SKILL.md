---
name: sdd-implement-task
metadata:
  version: 0.4.0
  pack: core
description: Implement exactly one validated SDD task as the smallest tested, merge-ready increment. Use for a single task reference or explicit task implementation request; not for planning a feature or coordinating several tasks.
---

# Implement one SDD task

## When to use

Use for one unambiguous task that is ready to implement or resume. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [the TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md) before acting.

## When not to use

Do not use for specification authoring, several tasks, a feature-wide validation, PR review, or a task whose identity, scope, or dependencies are ambiguous.

## Inputs

- A single canonical task reference or explicit feature and task identifiers.
- Repository SDD artifacts, relevant code, and `.sdd/config.yml`.
- Optional task prompt or prior handoff, treated as supporting evidence only.

## Workflow

1. Read `.sdd/config.yml` first. If it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`; otherwise use its paths, commands, and policy.
2. Resolve exactly one task from the configured SDD source. Confirm its acceptance criteria, dependencies, allowed scope, and current implementation state.
3. Inspect callers and existing patterns before editing. Stop if the work requires a spec change, sibling task, unsafe environment, or unresolved conflict.
4. Identify the behavior, public seam, test strategy, expected observable result, and narrowest test command. Stop when the seam is unclear.
5. Use one vertical slice at a time: produce RED when practical, implement the smallest change for GREEN, then refactor only after GREEN.
6. If strict TDD is impractical, report why, the replacement validation, remaining risk, and a follow-up test.
7. Report TDD evidence, changed files, checks, remaining risks, and the next SDD step. Do not commit, push, open a PR, or update external trackers unless the user separately asks.

## Safety

Preserve unrelated and pre-existing changes. Keep credentials, personal data, and local paths out of output. Do not mutate production, remote services, tracker state, Git history, or repository configuration by default.

## Output

Return the resolved task, outcome (`implemented`, `partial`, `blocked`, or `no changes required`), concise evidence, validation results, and recommended next step.
