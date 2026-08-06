---
name: sdd-create-specs
description: Create or update a repository-local, evidence-based SDD specification package. Use when a user asks to turn a feature request into requirements, acceptance criteria, design decisions, or implementation-ready specifications; read .sdd/config.yml before producing artifacts.
metadata:
  version: 0.1.0
  pack: core
---

# Create SDD Specifications

## When to use

Use when a feature, change, bug fix, or technical initiative needs an implementation-ready SDD specification package.

## When not to use

Do not use for direct implementation, a casual explanation, or an unscoped brainstorming request. Do not proceed without repository-local configuration; use `setup-sdd-agentic-flow` first.

## Inputs

- The requested outcome and known constraints.
- `.sdd/config.yml`.
- Relevant repository evidence: code, tests, existing decisions, and prior SDD artifacts.

## Workflow

1. Read `.sdd/config.yml` first and use its artifact paths, naming rules, and configured scope. If it is missing, ask the user to run `/setup-sdd-agentic-flow` or `npx sdd-agentic-flow init`.
2. Read `../sdd-agentic-flow-shared/references/tlc-baseline.md` to apply the common lifecycle and required decision points.
3. Read `../sdd-agentic-flow-shared/references/workflow-safety.md` before handling inputs or writing artifacts.
4. Inspect only evidence needed to state the current behavior, desired behavior, constraints, risks, and acceptance criteria. Mark unknowns as open questions rather than inventing facts.
5. Create exactly `context.md`, `spec.md`, `design.md`, and `tasks.md`; never create `validation.md`. Keep requirements traceable to evidence and acceptance criteria observable.
6. Check internal links, paths, and consistency with existing artifacts; summarize unresolved decisions.

## Safety

- Do not use private conversation context as specification evidence or copy secrets into artifacts.
- Do not access networks, install dependencies, or modify application code, infrastructure, or defaults.
- Preserve existing artifacts unless the user explicitly requests an update; identify any overwrite before it occurs.
- Apply `../sdd-agentic-flow-shared/references/workflow-safety.md` for data handling and confirmation requirements.

## Output

Return the created or updated artifact paths, a concise scope and acceptance-criteria summary, evidence consulted, and open questions or decisions required before implementation.
