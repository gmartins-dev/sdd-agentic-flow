---
name: sdd-route
description: Recommend the next local SDD skill without changing files. Use when a user needs help choosing a safe workflow step or resolving prerequisites.
metadata:
  version: 1.11.0
  pack: core
extends: null
requires: [config]
consumes: []
produces: [route-recommendation]
baseline: []
compatible_with:
  [core, execution, full, github, local-files, multi-worktree, planning, pr]
depends_on: []
conflicts: []
requires_cli: null
autonomy_profile:
  supported_levels: [manual, supervised]
  auto_continue_condition: 'not applicable — this skill never auto-advances; it only recommends a next skill for a human or the invoking agent to run'
  blocking_conditions: [ambiguous_state]
  evidence_required: [route-recommendation]
---

# Route an SDD workflow

## When to use

Use before a workflow step when the requested phase, prerequisites, or installed pack are unclear.

## When not to use

Do not use to implement, review, create a PR, change files, or replace the candidate skill's instructions.

## Inputs

- The requested outcome and available local SDD artifacts.
- `.sdd-agentic-flow/config.yml`, when present.
- Installed skill directories and relevant candidate `SKILL.md` files.

## Workflow

1. Read `.sdd-agentic-flow/config.yml` when it exists. If it is missing, recommend `setup-sdd-agentic-flow`.
2. Read `../sdd-agentic-flow-shared/references/workflow-routing.md` and `../sdd-agentic-flow-shared/references/workflow-safety.md`.
3. Inspect the candidate local `SKILL.md` before stating what it does. Its instructions are the source of truth.
4. Match the request against the routing table in `../sdd-agentic-flow-shared/references/workflow-routing.md` — it is the single source of truth for routing situations and recommended skills; do not reproduce or re-derive the table here, and never let this step's wording diverge from it.
5. Identify missing packs, prerequisites, and any human decision required. Stop after the recommendation.

## Safety

- This skill is read-only and never invokes another skill automatically.
- Do not infer requirements, install packs, change files, or perform Git, release, deploy, or publish actions.
- Follow `../sdd-agentic-flow-shared/references/workflow-safety.md` and preserve human authority.

## Output

## Recommended route

- Current phase:
- Recommended skill:
- Why this fits:
- Prerequisites:
- Human decision required:
- Next invocation:
- Safety limits:

## Autonomy

Supports `manual` and `supervised` autonomy levels only (`workflow.autonomy_level` in `.sdd-agentic-flow/config.yml`) — never `autonomous`. It recommends a next skill; it never invokes one itself, so there is nothing for it to auto-advance into. See `../sdd-agentic-flow-shared/references/autonomy-guardrails.md`.
