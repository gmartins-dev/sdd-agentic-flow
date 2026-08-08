---
name: sdd-create-prompts
description: Generate self-contained, paste-ready implementation prompts from a validated repository-local SDD specification package. Use when a user asks to split specifications into agent prompts or handoff prompts; read .sdd/config.yml first and do not implement the work.
metadata:
  version: 0.7.0
  pack: planning
extends: sdd-create-specs
requires: [config, spec-package]
consumes: [domain-glossary, project-context]
produces: [task-prompts]
baseline: [tlc-spec-driven, tdd]
compatible_with: [full, planning]
depends_on: []
conflicts: []
---

# Create SDD Implementation Prompts

## When to use

Use after an SDD specification package is ready and the user needs bounded implementation prompts for one or more tasks.

## When not to use

Do not use to create a specification from scratch, execute implementation, make repository changes outside prompt artifacts, or guess missing requirements. Use `sdd-create-specs` first when the specification is incomplete.

## Inputs

- `.sdd/config.yml`.
- A validated specification package and its acceptance criteria.
- Optional task ordering, ownership boundaries, and target agent constraints.

## Workflow

1. Read `.sdd/config.yml` first to locate the specification package and configured prompt output location. If it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`.
2. Read `../sdd-agentic-flow-shared/references/tlc-baseline.md` to preserve lifecycle gates and validation expectations.
3. Read `../sdd-agentic-flow-shared/references/tdd-baseline.md`, `../sdd-agentic-flow-shared/references/task-slicing.md`, and `../sdd-agentic-flow-shared/references/workflow-safety.md` before producing prompts.
4. Read `.sdd/context/project-context.md` and `.sdd/context/domain-glossary.md` when they exist.
5. Generate one prompt per Task, trace each to a bounded set of requirements and acceptance criteria, and save prompts to the configured location or `.sdd/prompts`.
6. Prefer independently verifiable vertical slices. Record explicit dependencies, public seams, and any justified horizontal slice or expand-contract strategy.
7. For code tasks, require behavior, public seam, test strategy, expected RED/GREEN commands, refactor scope, and TDD limitations.
8. Write self-contained prompts with scope, repository evidence to inspect, allowed files, explicit non-goals, implementation steps, and proportionate validation commands.
9. Verify every prompt references local paths, contains no private context or secrets, and collectively covers the requested criteria without overlapping ownership.

## Safety

- Generate text artifacts only; do not execute prompts, install dependencies, use the network, or change repository/global defaults.
- Do not include secrets, personal data, private conversation context, or unsupported claims.
- Keep instructions repository-local and flag any step requiring elevated access, external coordination, or destructive action for the user.
- Follow `../sdd-agentic-flow-shared/references/workflow-safety.md` for safety boundaries.

## Output

Return the prompt artifact paths plus a compact mapping of prompt to requirements, owned files, dependencies, and validation expected from the implementer.
