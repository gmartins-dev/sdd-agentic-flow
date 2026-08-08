# Artifact contracts

Every SDD artifact this package's skills produce has an implicit structure, mirrored by
`shared/templates/*.template.md`. This file documents that structure explicitly so skills and
`doctor` can confirm an artifact's required sections are present without inventing a new schema
format. This is a presence check, not full-schema validation — it does not verify section
*content*, only that the required headers exist.

- `spec.md` — required: `# Specification — {feature_slug}`, one `## Requirement {id}` per
  requirement, `## Acceptance criteria`. Produced by `sdd-create-specs`.
- `design.md` — required (when the artifact exists — it is optional for `small_fix`, see
  `feature-profiles.md`): `# Design — {feature_slug}`, `## Decision`, `## Path ownership`.
  Produced by `sdd-create-specs`.
- `tasks.md` — required: `# Tasks — {feature_slug}`, one `## {task_id}` per task (each with
  Acceptance criteria, Review boundary, Slice type, Independently verifiable, Public seam,
  Dependencies, Horizontal-slice justification, and Expand-contract strategy), plus a nested
  `## TDD baseline` subsection (Behavior under test, Public seam, Test strategy, Expected RED
  command, Expected GREEN command, Refactor scope, TDD limitations) for code tasks. Produced by
  `sdd-create-specs`.
- task-prompt — required: `# Task prompt — {task_id}`, `## Task slice` (same six fields as a
  `tasks.md` entry), `## TDD baseline` (same seven fields as above). Produced by
  `sdd-create-prompts`.
- check-report — required: `# Task check — {task_id}`, `## Evidence`, `## TDD evidence`
  (Behavior tested, Seam, RED, GREEN, REFACTOR, Broader checks, Limitations). Produced by
  `sdd-task-check`.
- pr-package — required: `# {feature_slug} — {task_id}`, `## Scope`, `## Evidence`. Produced by
  `sdd-create-pr`.

## Optional traceability convention

The required headers above are the only thing `doctor` and `scripts/check-skills.sh` check.
This section documents an **optional**, non-enforced ID convention skills and users may adopt
for end-to-end traceability from a requirement to its implementation and its PR. Nothing in this
package requires it, and adopting it does not change any artifact's required-headers contract
above.

- `spec.md` — prefix each `## Requirement {id}` heading with a stable identifier, for example
  `## Requirement REQ-1: <title>`.
- `tasks.md` / task-prompt — reference the requirement(s) a task fulfills in its existing
  `Dependencies` field, for example `Dependencies: REQ-1, REQ-3`.
- pr-package — reference the same identifier(s) in its existing `## Scope` section, for
  example `Scope: implements REQ-1`.

Because this only reuses existing required fields (`## Requirement {id}`, `Dependencies`,
`## Scope`) with a suggested naming pattern, it stays compatible with every artifact's contract
above without adding a new required section.
