# Golden flow: greenfield

Illustrative greenfield spec package. Executable CLI lifecycle checks live in
`scripts/cli-certification.ts`; these artifacts do not prove a host implemented the feature.

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow install --scope project --adoption-mode team
```

Then the artifacts a real `saf-create-spec` run in **source-item mode** would produce for
this feature are placed at `.specs/features/task-management/`:

- `context.md`
- `spec.md`
- `design.md`
- `tasks.md`

These are the same files in this directory — this feature is "task management with due dates
and notifications" (see `source-item.md`).

```bash
sdd-agentic-flow doctor --json
```

## Expected result

- `spec.md`, `design.md`, and `tasks.md` carry the required headers
  `shared/references/artifact-contracts.md` documents for them (`# Specification —
  task-management`, `## Requirement REQ-1`, `## Acceptance criteria`; `# Design —
  task-management`, `## Decision`, `## Path ownership`; `# Tasks — task-management`, `##
  T1`/`T2`/`T3`, each with a nested `## TDD baseline`).
- `doctor --json`'s `artifact-contracts` and `evidence-first` checks are `PASS`.
- Overall `doctor` status is not `FAIL`.
