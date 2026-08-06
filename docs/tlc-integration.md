# TLC integration

`sdd-agentic-flow` ships its own condensed, self-contained adaptation of the TLC methodology —
it is not a runtime dependency on the full `tlc-spec-driven` skill, and does not install or
invoke it.

## What this package ships

- `shared/references/tlc-baseline.md` — the condensed planning baseline: **Specify → Discuss →
  Design → Tasks → Execute → Verify**, with invariants (no invented requirements, stop-and-report
  on missing evidence or authority, RED → GREEN → REFACTOR for implementation, no completion
  claims without evidence).
- `shared/references/tdd-baseline.md` — the condensed implementation baseline: a
  RED → GREEN → REFACTOR loop over behavior-focused tests at public seams and vertical slices.
- `shared/baselines/registry.yml` — registers both with an independent `baseline_version`.

## What this package does not ship

The full `tlc-spec-driven` skill (sub-agent delegation, the Verifier's discrimination sensor,
`LESSONS.md` distillation, the Knowledge Verification Chain, `STATE.md`) and the full `tdd` skill
this package is inspired by are **external, separately-installed skills** — see
[inspirations](inspirations.md), [NOTICE](../NOTICE), and [LICENSING.md](../LICENSING.md) for
attribution. Nothing in `sdd-agentic-flow` requires either to be installed.

## Internal implementation mapping

`sdd-create-specs` owns Specify through Tasks. `sdd-implement-task` and `sdd-implement-multi`
implement the Execute intent. `sdd-task-check` and `sdd-validation` implement Verify. Direct TLC
Execute is not invoked. See the full mapping in
[architecture.md](architecture.md#capability-contracts).

## What the Baseline Compliance gate verifies

`doctor` checks `baseline-tlc`, `adaptive-sizing`, `traceability`, and `evidence-first`. These
are **presence and configuration checks**, not behavioral verification: `doctor` confirms the
shipped baseline files and quality-gate configuration are intact. It cannot observe whether an
agent actually followed Specify → Verify or RED → GREEN → REFACTOR in a given session — that
remains a human-review responsibility.

## Synchronization policy

When the external `tlc-spec-driven`/`tdd` skills change in ways that affect their public stages
or loop, this package's condensed baselines are updated deliberately and the change is called out
under a "Baseline changes" note in [CHANGELOG.md](../CHANGELOG.md) — never silently.
