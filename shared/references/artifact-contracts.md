# Artifact contracts

Every SDD artifact this package's skills produce has an implicit structure, mirrored by
`shared/templates/*.template.md`. This file documents that structure explicitly so skills and
`doctor` can confirm an artifact's required sections are present without inventing a new schema
format. This is a presence check, not full-schema validation. It does not verify section
*content*, only that the required headers exist.

- `spec.md`: required `# Specification — {feature_slug}`, one `## Requirement {id}` per
  requirement, `## Acceptance criteria`. Produced by `saf-create-spec`. Optional invariant
  sentences may live **inside** those existing headers (`INV-…` is an allowed ID, like
  optional `REQ-{id}`). There is no required `## Invariants` header. Work-type content
  (feature / bugfix / refactor / investigation / maintenance — see
  [work-types.md](work-types.md)) also lives **inside** those existing headers: unchanged
  behavior, regression sensors, root cause, and fix boundary are required *content* when
  intent is bugfix, not a required `## Unchanged behavior` H2 and not a `bugfix.md` file.
- `design.md`: required when the artifact exists (optional for `small_fix`; see
  `feature-profiles.md`): `# Design — {feature_slug}`, `## Decision`, `## Path ownership`.
  Produced by `saf-create-spec`.
- `tasks.md`: required `# Tasks — {feature_slug}`, one `## {task_id}` per task (each with
  Acceptance criteria, Review boundary, Slice type, Independently verifiable, Public seam,
  Dependencies, Horizontal-slice justification, and Expand-contract strategy), plus a nested
  `## TDD baseline` subsection (Behavior under test, Public seam, Test strategy, Expected RED
  command, Expected GREEN command, Refactor scope, TDD limitations) for code tasks. Produced by
  `saf-create-spec`. Field **labels** are frozen. `Public seam` means the contractual seam
  (prefer public/observable when practical). `Expected RED command` is historical/diagnostic;
  `n/a` is valid and must not be fabricated. `Expected GREEN command` is the passing-sensor
  command(s) for the slice. Optional extra bullets when useful: Spec anchor, Anti-tautology,
  Independent of authoring assumptions.
- task-prompt: required `# Task prompt — {task_id}`, `## Task slice` (same six fields as a
  `tasks.md` entry), `## TDD baseline` (same seven fields as above). Produced by
  `saf-create-prompts`.
- check-report: required `# Task check — {task_id}`, a top-line `Status:` field, `## Validation scope` (impact, obligations, selected and omitted sensors; see
  [evidence-standard.md](evidence-standard.md)'s `Status:` field/guardrail 1 mapping),
  `## Evidence`, `## TDD evidence` (Behavior tested, Seam, RED, GREEN, REFACTOR, Broader checks,
  Limitations). Produced by `saf-check-task`. `Seam` is the contractual seam. Distinguish
  current vs historical vs not-run in Evidence / Limitations prose. Missing RED is not an
  automatic fail. A passing sensor is evidence, not a correctness verdict.
- validation-report: required `# Feature validation — {feature_slug}`, a top-line `Status:`, `## Validation scope` (impact, obligations, selected and omitted sensors),
  field (same convention as check-report), `## Evidence`, `## TDD evidence` (same seven fields as
  above). Produced by `saf-validate`. Same freshness and gap rules as check-report: current
  evidence only; never silent PASS.
- pr-package: required `# {feature_slug} — {task_id}`, `## Scope`, `## Evidence`. Produced by
  `saf-create-pr`.

## Optional traceability convention

The required headers above are the only thing `doctor` and `scripts/check-skills.sh` check.
This section documents an **optional**, non-enforced ID convention skills and users may adopt
for end-to-end traceability from a requirement to its implementation and its PR. Nothing in this
package requires it, and adopting it does not change any artifact's required-headers contract
above.

- `spec.md`: prefix each `## Requirement {id}` heading with a stable identifier, for example
  `## Requirement REQ-1: <title>`.
- `tasks.md` / task-prompt: reference the requirement(s) a task fulfills in its existing
  `Dependencies` field, for example `Dependencies: REQ-1, REQ-3`.
- pr-package: reference the same identifier(s) in its existing `## Scope` section, for
  example `Scope: implements REQ-1`.

Because this only reuses existing required fields (`## Requirement {id}`, `Dependencies`,
`## Scope`) with a suggested naming pattern, it stays compatible with every artifact's contract
above without adding a new required section.
