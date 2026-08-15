# Golden flow: greenfield

Proved by `test/cli.test.js` — `golden flow: greenfield init -> install core -> copy spec
artifacts -> doctor PASS`. This file describes what that test exercises; it is not a
promise beyond what the test actually checks (see `docs/environment-compatibility.md` for the
project's stance on documentation vs. mechanically-proved claims).

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow install core --scope project
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
