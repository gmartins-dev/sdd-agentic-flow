# Golden flow: idea to spec

Proved by `test/cli.test.ts` — `golden flow: idea to spec — brainstorm brief converges into a
saf-create-spec package`. This file describes what that test exercises; it is not a promise
beyond what the test actually checks (see `docs/environment-compatibility.md` for the project's
stance on documentation vs. mechanically-proved claims).

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow install planning --scope project
```

The idea starts vague: "notifications are too noisy at night." A real `saf-brainstorm` run in
**exploratory mode** would ask what "noisy" means, what happens today, and why muting isn't an
acceptable workaround, until the problem and a decided approach converge. That converged state
is `brief.md` in this directory — the same file this test copies to
`.specs/features/quiet-hours-notifications/brief.md`.

Then the artifacts a real `saf-create-spec` run in **source-item mode** would produce from that
brief are placed at the same feature path:

- `context.md`
- `spec.md`
- `design.md`
- `tasks.md`

These are the same files in this directory. `saf-brainstorm` never writes any of the four —
only `brief.md` — matching its own `SKILL.md`'s constraint that it always hands off to
`saf-create-spec` rather than authoring a spec package itself.

```bash
sdd-agentic-flow doctor --json
```

## Expected result

- `brief.md` exists alongside the spec package at the same feature path (a feature can carry
  both once the idea has converged and been formalized).
- `spec.md`, `design.md`, and `tasks.md` carry the required headers
  `shared/references/artifact-contracts.md` documents for them (`# Specification —
  quiet-hours-notifications`, `## Requirement REQ-1`, `## Acceptance criteria`; `# Design —
  quiet-hours-notifications`, `## Decision`, `## Path ownership`; `# Tasks —
  quiet-hours-notifications`, `## T1`/`T2`, each with a nested `## TDD baseline`).
- `doctor --json`'s `artifact-contracts` and `evidence-first` checks are `PASS`.
- Overall `doctor` status is not `FAIL`.
