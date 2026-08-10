# Evidence standard

Six skills restated this principle in slightly different sentences. That drift created real
maintenance cost. This file is the single generic statement; each consuming skill keeps only the
domain-specific vocabulary listed below and references this file for the shared rule.

## The principle

- A claim of completion, correctness, or readiness is valid only when it is backed by evidence
  gathered during the current check: a real command, its real output, its real exit code.
- Evidence from a prior run is context, not proof. State can change between runs. A check that
  reuses a stale result without re-running it is not a check.
- Never invent a command result, a CI status, or a test outcome. If a check was not run, say so
  and say why, rather than presenting an assumed or expected result as observed.
- When evidence is missing, incomplete, or contradictory, the classification reflects that gap
  (`blocked`, `inconclusive`, `needs changes`). Missing evidence is never silently upgraded to a
  pass.

## Local vocabulary per skill

Each skill below applies the principle above with wording specific to its own domain. The local
wording is the operative text inside that skill's `SKILL.md`. This file is the shared rule it
implements, not a replacement for it.

- **`sdd-create-specs`**: classifies every finding as **Observed** (directly shown by code or a
  passing test), **Inferred** (a reasonable reading no test directly confirms), or **Unknown** (a
  gap neither code nor tests answer), and never presents an Inferred or Unknown finding as
  Observed.
- **`sdd-implement-task`**: when strict TDD is impractical, reports why, the replacement
  validation used instead, the remaining risk, and a follow-up test to close the gap.
- **`sdd-task-check`**: "never turn missing evidence into a pass": records which commands were
  not run and why, rather than assuming they would have passed.
- **`sdd-validation`**: "evidence from prior runs is context, not proof": always re-runs
  configured, safe, applicable gates and records actual current commands and results.
- **`sdd-pr-review`**: "do not invent CI results": verifies every finding with code or
  reproducible evidence before separating blocking defects from non-blocking observations.
- **`sdd-pr-fix`**: keeps a findings ledger that classifies preferences, missing evidence, and
  spec drift without altering their classification just to close them out.

A skill's local vocabulary may add nuance for its domain; it must never contradict the generic
principle above.

## `Status:` field and the guardrail 1 mapping

`shared/templates/check-report.template.md` and `shared/templates/validation-report.template.md`
carry a top-line `Status: {{status}}` field, filled with the producing skill's own local
vocabulary (`sdd-task-check`: `pass`/`needs changes`/`blocked`/`inconclusive`; `sdd-validation`:
`ready`/`not ready`/`blocked`/`inconclusive`). This does not introduce a new, universal status
enum; `skill-authoring-standard.md`'s existing per-skill vocabulary rule is unchanged.

[Guardrail 1](autonomy-guardrails.md) ("the skill reports `PASS`/`DONE`, not `IN_PROGRESS`,
`UNKNOWN`, or `FAIL`") reads this field, not the surrounding prose, and maps each skill's own
positive value to a pass: `pass` (`sdd-task-check`) and `ready` (`sdd-validation`) count as
`PASS`; every other local value (`needs changes`, `not ready`, `blocked`, `inconclusive`) counts
as not-`PASS` and blocks an `autonomous` advance the same way a literal `FAIL` would. A skill
must never write `Status: pass`/`Status: ready` while a required check in `## Evidence` recorded
a failure. The same "missing evidence is never silently upgraded to a pass" rule above applies
to this field specifically.
