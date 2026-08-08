---
name: sdd-validation
metadata:
  version: 1.0.0
  pack: core
description: Independently validate an accumulated SDD feature implementation against its specification and configured gates. Use for feature readiness after task work; not for implementing fixes or reviewing one task PR.
extends: sdd-task-check
requires: [config, spec-package, task-evidence]
consumes: [domain-glossary, project-context]
produces: [validation-report]
baseline: [tlc-spec-driven, tdd]
compatible_with: [core, full, github, local-files]
depends_on: []
conflicts: []
requires_cli: null
---

# Validate an SDD feature

## When to use

Use when the user asks whether one implemented feature is ready against its SDD. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [the TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md), [task slicing](../sdd-agentic-flow-shared/references/task-slicing.md), [feature profiles](../sdd-agentic-flow-shared/references/feature-profiles.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use to implement code, repair findings, validate only one task, create a PR, or infer a feature identity from ambiguous branch names.

## Inputs

- One feature identifier.
- `.sdd/config.yml`, feature context/spec/design/tasks artifacts, accumulated implementation, and configured gates.

## Workflow

1. Read `.sdd/config.yml` first. If it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`; otherwise resolve exactly one feature and its configured validation paths and commands.
2. Read `.sdd/context/project-context.md` and `.sdd/context/domain-glossary.md` when they exist. Read `workflow.feature_profile` from `.sdd/config.yml` and apply feature-profile guidance to calibrate expected rigor. Build a Markdown-first evidence matrix from requirements, scenarios, decisions, tasks, code, tests, and delivery scope.
3. Confirm task-level TDD evidence for code changes, including behavior, public seams, GREEN checks, explained deviations, and untested risks.
4. Confirm task slices have independent checks or recorded horizontal-slice justifications and dependencies.
5. Run only configured, safe, applicable validation gates. Record actual commands and results; evidence from prior runs is context, not proof.
6. Decide `ready`, `not ready`, `blocked`, or `inconclusive`. A feature is ready only when all mandatory criteria have current evidence and required gates pass.
7. Produce a sanitized local report in `.sdd/reports` when configuration permits; never create `validation.md` under `.specs`.

## Safety

Remain read-only except for permitted local report or disposable test artifacts. Do not change code, specs, Git history, PR metadata, trackers, remote services, or default configuration. Preserve existing work and redact secrets, PII, and absolute paths.

## Output

Return feature identity, decision, requirement/task evidence counts, required gate results, ranked gaps, report location if written, and next step.
