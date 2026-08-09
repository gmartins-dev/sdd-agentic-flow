# Evidence standard

A conclusion is only as good as the verifiable evidence behind it. This principle was already
implemented six times over, in six slightly different sentences, across the skills that produce a
pass/fail/ready-style classification — a real maintenance drift, not a stylistic choice. This
file is the single generic statement of the principle; each consuming skill keeps only the
domain-specific vocabulary listed below, referencing this file for the shared rule instead of
restating it.

## The principle

- A claim of completion, correctness, or readiness is valid only when it is backed by evidence
  gathered during the current check — a real command, its real output, its real exit code.
- Evidence from a prior run is context, not proof. State can change between runs; a check that
  reuses a stale result without re-running it is not a check.
- Never invent a command result, a CI status, or a test outcome. If a check was not run, say so
  and say why, rather than presenting an assumed or expected result as observed.
- When evidence is missing, incomplete, or contradictory, the classification reflects that gap
  (`blocked`, `inconclusive`, `needs changes`) — missing evidence is never silently upgraded to a
  pass.

## Local vocabulary per skill

Each skill below applies the principle above with wording specific to its own domain. The local
wording is the operative text inside that skill's `SKILL.md`; this file is the shared rule it
implements, not a replacement for it.

- **`sdd-create-specs`** — classifies every finding as **Observed** (directly shown by code or a
  passing test), **Inferred** (a reasonable reading no test directly confirms), or **Unknown** (a
  gap neither code nor tests answer), and never presents an Inferred or Unknown finding as
  Observed.
- **`sdd-implement-task`** — when strict TDD is impractical, reports why, the replacement
  validation used instead, the remaining risk, and a follow-up test to close the gap.
- **`sdd-task-check`** — "never turn missing evidence into a pass": records which commands were
  not run and why, rather than assuming they would have passed.
- **`sdd-validation`** — "evidence from prior runs is context, not proof": always re-runs
  configured, safe, applicable gates and records actual current commands and results.
- **`sdd-pr-review`** — "do not invent CI results": verifies every finding with code or
  reproducible evidence before separating blocking defects from non-blocking observations.
- **`sdd-pr-fix`** — keeps a findings ledger that classifies preferences, missing evidence, and
  spec drift without altering their classification just to close them out.

A skill's local vocabulary may add nuance for its domain; it must never contradict the generic
principle above.
