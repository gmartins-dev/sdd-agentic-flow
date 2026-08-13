---
name: sdd-validation
description: Independently validate an accumulated SDD feature implementation against its specification and configured gates. Use for feature readiness after task work; not for implementing fixes or reviewing one task PR.
metadata:
  version: 1.14.0
  pack: core
extends: sdd-task-check
requires: [config, spec-package, task-evidence]
consumes: [domain-glossary, project-context]
produces: [validation-report]
baseline: [tlc-spec-driven, tdd]
compatible_with: [core, full, github, local-files]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'validation-report present with status PASS and every specification requirement satisfied'
  blocking_conditions: [requirements_unmet, gates_failed]
  evidence_required: [validation-report]
---

# Validate an SDD feature

## When to use

Use when the user asks whether one implemented feature is ready against its SDD. Read [the TLC baseline](../sdd-agentic-flow-shared/references/tlc-baseline.md), [the TDD baseline](../sdd-agentic-flow-shared/references/tdd-baseline.md), [task slicing](../sdd-agentic-flow-shared/references/task-slicing.md), [feature profiles](../sdd-agentic-flow-shared/references/feature-profiles.md), and [safety rules](../sdd-agentic-flow-shared/references/workflow-safety.md).

## When not to use

Do not use to implement code, repair findings, validate only one task, create a PR, or infer a feature identity from ambiguous branch names. For a single task before handoff/PR, use `sdd-task-check` instead — this skill assumes several already-checked tasks have accumulated.

## Inputs

- One feature identifier.
- `.sdd-agentic-flow/config.yml`, feature context/spec/design/tasks artifacts, accumulated implementation, and configured gates.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` first. If it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`; otherwise resolve exactly one feature and its configured validation paths and commands.
2. Read `.sdd-agentic-flow/context/project-context.md` and `.sdd-agentic-flow/context/domain-glossary.md` when they exist. Read `workflow.feature_profile` from `.sdd-agentic-flow/config.yml` and apply feature-profile guidance to calibrate expected rigor. Build a Markdown-first evidence matrix from requirements, scenarios, decisions, tasks, code, tests, and delivery scope.
3. Re-read the spec **and** normative repo contracts. Confirm task-level TDD evidence for code changes: behavior, contractual seams, current passing-sensor commands, explained deviations, untested risks, and requirement-to-evidence traceability. Treat stale results as context, not current proof. Record explicit evidence gaps. Distinguish verification limits from implementation failures.
4. Confirm task slices have independent checks or recorded horizontal-slice justifications and dependencies.
5. Run only configured, safe, applicable validation gates, applying `../sdd-agentic-flow-shared/references/evidence-standard.md`. Record actual **current** commands and results; evidence from prior runs is context, not proof. A passing sensor is evidence, not a correctness verdict.
6. Decide `ready`, `not ready`, `blocked`, or `inconclusive`. A feature is ready only when all mandatory criteria have current adequate evidence and required gates pass. Never silent PASS.
7. Produce a sanitized local report in `.sdd-agentic-flow/reports` when configuration permits; never create `validation.md` under `.specs`.

## Safety

Remain read-only except for permitted local report or disposable test artifacts. Do not change code, specs, Git history, PR metadata, trackers, remote services, or default configuration. Preserve existing work and redact secrets, PII, and absolute paths.

## Output

Return feature identity, decision, requirement/task evidence counts, required gate results, ranked gaps, report location if written, and next step. When the decision is `not ready`, `blocked`, or `inconclusive` and resolution is likely to span a session or agent boundary, write or update `handoff.md` per `../sdd-agentic-flow-shared/references/handoff-standard.md`.

## Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in `.sdd-agentic-flow/config.yml`). In `autonomous` mode, treating the feature as ready for `sdd-create-pr` requires a validation-report with status PASS and every specification requirement satisfied; an unmet requirement or failed gate blocks that advance. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
