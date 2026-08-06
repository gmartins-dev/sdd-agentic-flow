---
name: sdd-validation
metadata:
  version: 0.2.0
  pack: core
description: Independently validate an accumulated SDD feature implementation against its specification and configured gates. Use for feature readiness after task work; not for implementing fixes or reviewing one task PR.
---

# Validate an SDD feature

## When to use

Use when the user asks whether one implemented feature is ready against its SDD. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md) and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use to implement code, repair findings, validate only one task, create a PR, or infer a feature identity from ambiguous branch names.

## Inputs

- One feature identifier.
- `.sdd/config.yml`, feature context/spec/design/tasks artifacts, accumulated implementation, and configured gates.

## Workflow

1. Read `.sdd/config.yml` first. If it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`; otherwise resolve exactly one feature and its configured validation paths and commands.
2. Build a Markdown-first evidence matrix from requirements, scenarios, decisions, tasks, code, tests, and delivery scope.
3. Run only configured, safe, applicable validation gates. Record actual commands and results; evidence from prior runs is context, not proof.
4. Decide `ready`, `not ready`, `blocked`, or `inconclusive`. A feature is ready only when all mandatory criteria have current evidence and required gates pass.
5. Produce a sanitized local report in `.sdd/reports` when configuration permits; never create `validation.md` under `.specs`.

## Safety

Remain read-only except for permitted local report or disposable test artifacts. Do not change code, specs, Git history, PR metadata, trackers, remote services, or default configuration. Preserve existing work and redact secrets, PII, and absolute paths.

## Output

Return feature identity, decision, requirement/task evidence counts, required gate results, ranked gaps, report location if written, and next step.
