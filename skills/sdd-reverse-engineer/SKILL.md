---
name: sdd-reverse-engineer
description: Produce a repository-local, evidence-based SDD specification package from existing, undocumented code. Use when a user asks to document or formalize behavior that already exists in the codebase but has no spec, and there is no source item to start from; read .sdd/config.yml before producing artifacts.
metadata:
  version: 0.7.0
  pack: core
extends: null
requires: [config, existing-codebase]
consumes: [project-context]
produces: [spec-package]
baseline: [tlc-spec-driven]
compatible_with: [core, full]
depends_on: []
conflicts: []
---

# Reverse-engineer SDD specifications

## When to use

Use when a feature or module already exists in the codebase, has no prior SDD specification, and a spec package needs to be produced from the code itself rather than from a requested outcome.

## When not to use

Do not use when a source item, ticket, or requested outcome already exists — use `sdd-create-specs` instead. Do not use for direct implementation, a casual explanation, or an unscoped brainstorming request. Do not proceed without repository-local configuration; use `setup-sdd-agentic-flow` first.

## Inputs

- **Scope** (required): the specific module, feature, package, directory, or bounded area to
  reverse-engineer, explicitly named by the user. Never proceed against an unstated or
  whole-repository scope — ask the user to name a bounded area first.
- `.sdd/config.yml`.
- Relevant repository evidence: code, tests, existing decisions, and prior SDD artifacts within
  the stated scope.

## Workflow

1. **Discover.** Confirm the user has named an explicit scope — a specific module, feature, or
   bounded area, not the whole repository; ask for one before continuing if it is missing or too
   broad. Read `.sdd/config.yml` next and use its artifact paths, naming rules, and configured
   scope. If `.sdd/config.yml` is missing, ask the user to run `/setup-sdd-agentic-flow` or
   `npx sdd-agentic-flow init`.
2. **Discover.** Read `../sdd-agentic-flow-shared/references/tlc-baseline.md` to apply the
   common lifecycle and required decision points. Read `workflow.feature_profile` from
   `.sdd/config.yml` and apply `../sdd-agentic-flow-shared/references/feature-profiles.md`
   guidance to scope the package's depth.
3. **Discover.** Read `../sdd-agentic-flow-shared/references/task-slicing.md`,
   `../sdd-agentic-flow-shared/references/artifact-contracts.md`, and
   `../sdd-agentic-flow-shared/references/workflow-safety.md` before handling inputs or writing
   artifacts.
4. **Discover.** Read `.sdd/context/project-context.md` when it exists; treat it as read-only
   discovered output.
5. **Inspect.** Inspect the named code, its tests, and its call sites within the confirmed
   scope. Classify every finding as **Observed** (directly shown by code or a passing test),
   **Inferred** (a reasonable reading of the code that no test directly confirms), or
   **Unknown** (a gap neither the code nor its tests answer). Never present an Inferred or
   Unknown finding as Observed.
6. **Reconstruct.** Create exactly `context.md`, `spec.md`, and `design.md` describing the
   behavior as it exists today, labeling every requirement and decision Observed, Inferred, or
   Unknown; only create `tasks.md` if the user confirms follow-up work is needed. Never create
   `validation.md`.
7. **Handoff.** Check internal links, paths, and consistency with existing artifacts; summarize
   Observed behavior, Inferred behavior, and Unknown/open questions, and any gaps between
   observed behavior and observed tests, so the user can confirm or correct each Inferred and
   Unknown item before it is relied on.

## Safety

- Do not use private conversation context as specification evidence or copy secrets into artifacts.
- Do not access networks, install dependencies, or modify application code, infrastructure, or defaults.
- Preserve existing artifacts unless the user explicitly requests an update; identify any overwrite before it occurs.
- Never present Inferred or Unknown findings as Observed, confirmed requirements; label every finding Observed, Inferred, or Unknown.
- Apply `../sdd-agentic-flow-shared/references/workflow-safety.md` for data handling and confirmation requirements.

## Output

Return the created artifact paths; evidence consulted (files, tests, call sites); and a concise
summary of findings labeled Observed, Inferred, or Unknown, so the reader can distinguish
confirmed behavior from inference and unresolved gaps at a glance.
