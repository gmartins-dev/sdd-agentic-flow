# TDD baseline

This baseline governs implementation work in `sdd-agentic-flow`.

It is inspired by and adapted from the public `tdd` skill in
`mattpocock/skills` for local-first, agent-client-agnostic SDD workflows.
Attribution does not imply endorsement.

## Purpose

Use this baseline when an SDD task moves from planning into implementation.
TDD is a RED → GREEN → REFACTOR loop that uses behavior-focused tests at agreed
public seams.

## Core loop

1. Identify the behavior and expected observable result.
2. Confirm the public seam and the test command.
3. Write or update the smallest useful failing test and observe RED.
4. Implement the smallest change that passes the test and observe GREEN.
5. Refactor only after GREEN.
6. Run broader checks when the change needs them.
7. Report commands, results, limitations, and untested risks.

## Tests and seams

Test behavior through public interfaces. A useful test reads like a
specification, survives internal refactors, and does not assert private details.

Before writing a test, identify:

- behavior under test;
- public seam and why it is appropriate;
- expected observable result;
- narrowest command that proves the behavior;
- smallest vertical slice;
- risks or unclear seams.

Do not test unconfirmed internals. Preserve domain vocabulary when the project
defines it.

## Vertical slices

Use one behavior → one test → one implementation → evidence → next behavior.

Do not write all tests first and all implementation later. That horizontal
approach weakens feedback and produces tests coupled to imagined structure.

## Refactor and exceptions

Refactor only after GREEN. Preserve observed behavior and avoid broad redesigns
unless the task requires them.

When strict TDD cannot produce RED, report why, the alternative validation, the
remaining risk, and the test that should be added later. Characterization,
regression, approval, snapshot, or explicit manual validation can provide
evidence when appropriate.

## Evidence contract

Implementation reports record:

- behavior tested;
- public seam;
- test command;
- RED evidence, when produced;
- GREEN evidence;
- REFACTOR evidence, when applicable;
- broader checks;
- limitations and untested risks.

## Language profile

Render human-facing prose according to `.sdd/config.yml`. Keep `RED`, `GREEN`,
`REFACTOR`, `TDD`, `seam`, `public interface`, `behavior`, `test command`,
`PASS`, `WARN`, `FAIL`, `Blocked`, `Partial`, and `Completed` canonical.
