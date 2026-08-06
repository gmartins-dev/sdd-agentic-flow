---
name: sdd-task-check
metadata:
  version: 0.5.0
  pack: core
description: Independently check one implemented SDD task against its acceptance criteria and configured gates before handoff. Use for a task-scoped readiness check, not feature-wide validation or code changes.
---

# Check one SDD task

## When to use

Use after implementing one task and before commit or PR handoff. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [the TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md), [task slicing](../sdd-agentic-flow-shared/references/task-slicing.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use to implement fixes, review an entire feature, approve a PR, or infer an ambiguous task identity.

## Inputs

- One canonical task reference.
- `.sdd/config.yml`, the task's SDD artifacts, current diff, and configured validation commands.

## Workflow

1. Read `.sdd/config.yml` first; if it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`, then resolve exactly one task.
2. Read `.sdd/context/domain-glossary.md` when it exists. Map every task criterion to concrete implementation and executable evidence. Inspect changed files for scope drift and pre-existing changes.
3. Check that code tasks identify a behavior and public seam, use behavior-focused tests, record executed commands, and explain missing RED evidence.
4. Confirm the declared slice is independently verifiable, or that horizontal work and dependencies are explicitly justified.
5. Run only configured, safe, task-relevant checks. Record commands not run and why; never turn missing evidence into a pass.
6. Classify the task as `pass`, `needs changes`, `blocked`, or `inconclusive`, with actionable gaps.

## Safety

This is read-only except for disposable test artifacts permitted by configuration. Do not change code, specs, Git, trackers, PRs, remote services, or default configuration.

## Output

Return task identity, criterion-to-evidence summary, executed checks, scope findings, final classification, and next step.
