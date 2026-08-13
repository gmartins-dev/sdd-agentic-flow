---
name: sdd-task-check
description: Independently check one implemented SDD task against its acceptance criteria and configured gates before handoff. Use for a task-scoped readiness check, not feature-wide validation or code changes.
metadata:
  version: 1.15.0
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
  auto_continue_condition: 'check-report present with status PASS (PASS invalid on a false-positive catalog hit) and every configured gate satisfied'
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
- `.sdd-agentic-flow/config.yml`, the task's SDD artifacts, current diff, and configured validation commands.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` first; if it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`, then resolve exactly one task.
2. Follow this **fresh-eyes** order (state-checking, not narrative-judging): re-read spec + repo contracts → re-derive expected per AC (ignore implementer narrative) → run current sensor commands (environment state) → requirement coverage matrix (`requirement → sensor → current result`) → apply false-positive catalog → Status (existing enum only). Read `.sdd-agentic-flow/context/project-context.md` and `.sdd-agentic-flow/context/domain-glossary.md` when they exist. Inspect changed files for scope drift and pre-existing changes.
3. Identify the task's required behaviors. Select the smallest sensor set that still covers those behaviors and relevant failure modes (minimize redundancy, not coverage). Confirm each sensor observes a contractual seam and that its oracle/acceptance condition is grounded in spec, repo contracts, or configured gates — not inferred solely from the implementation. Flag tautology. Missing RED is not an automatic fail; `n/a — not used as proof` is valid. For each required behavior, name one wrong implementation that the current sensors would still pass (**non-shallow litmus**). If you cannot, record **Shallow sensor** or an evidence gap — not PASS.
4. Confirm the declared slice is independently verifiable, or that horizontal work and dependencies are explicitly justified. An unmapped AC cannot silently PASS.
5. Run only configured, safe, task-relevant checks, applying `../sdd-agentic-flow-shared/references/evidence-standard.md`. Record commands and results as **evidence** (command, exit status, observed result, requirement mapping). Distinguish current vs historical vs not-run in Evidence / Limitations prose. Record missing or inadequate sensors as explicit gaps. Never turn missing evidence into a pass. A passing sensor is evidence, not a correctness verdict. Self-report is not evidence (`self-report is not evidence`). This skill must not inherit author narrative.
6. Classify the task as `pass`, `needs changes`, `blocked`, or `inconclusive`, with actionable gaps. Never write `Status: pass` on a false-positive catalog hit. Do not implement fixes, edit tests to force PASS, LGTM from prose, use the changed implementation as the correctness oracle, or rewrite the test suite as a second implementation.

## Safety

This is read-only except for disposable test artifacts permitted by configuration. Do not change code, specs, Git, trackers, PRs, remote services, or default configuration. Self-report is not evidence. This skill must not inherit author narrative.

## Output

Return task identity, criterion-to-evidence summary, executed checks, scope findings, final classification, and next step. When the classification is `needs changes`, `blocked`, or `inconclusive` and resolution is likely to span a session or agent boundary, write or update `handoff.md` per `../sdd-agentic-flow-shared/references/handoff-standard.md`.

## Autonomy

Supports `manual`, `supervised`, and `autonomous` autonomy levels (`workflow.autonomy_level` in `.sdd-agentic-flow/config.yml`). In `autonomous` mode, advancing to `sdd-create-pr` or `sdd-validation` requires a check-report with status PASS and every configured gate satisfied (PASS invalid on a false-positive catalog hit); an unmet acceptance criterion or failed gate blocks the advance. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
