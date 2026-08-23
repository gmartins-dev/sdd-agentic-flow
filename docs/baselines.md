# Baselines

`sdd-agentic-flow` ships its own condensed, self-contained **planning** and **implementation**
baselines. They are not runtime dependencies on the full external `tlc-spec-driven` or `tdd`
skills, and this package does not install or invoke either.

## What this package ships

- `shared/references/tlc-baseline.md`: the condensed planning baseline: **Specify → Discuss →
  Design → Tasks → Execute → Verify**, with invariants (no invented requirements, stop-and-report
  on missing evidence or authority, current adequate behavioral evidence at contractual seams
  for implementation, no completion claims without evidence, on-demand load for the current
  feature and operation — do not load multiple feature specs simultaneously). The RED → GREEN → REFACTOR ritual
  is optional and is not the proof mechanism.
- `shared/references/tdd-baseline.md`: the condensed implementation baseline: name the behavior,
  place a sensor at the contractual seam, implement, and record current evidence. Test-first is
  recommended when it sharpens the spec. Full TDD ritual is optional.
- `shared/baselines/registry.yml`: registers both with an independent `baseline_version`.

## What this package does not ship

The full `tlc-spec-driven` skill (sub-agent delegation, the Verifier's discrimination sensor,
`LESSONS.md` distillation, the Knowledge Verification Chain, `STATE.md`) and the full `tdd` skill
this package is inspired by are **external, separately-installed skills**. See
[inspirations](inspirations.md), [NOTICE](../NOTICE), and [LICENSING.md](../LICENSING.md) for
attribution. Nothing in `sdd-agentic-flow` requires either to be installed.

## Upstream version pins

Both condensed baselines are adapted from a specific point-in-time version of their upstream
skill, pinned explicitly so drift is visible and any future re-sync is a deliberate decision,
never silent:

| Baseline | Upstream source | Pinned version |
| --- | --- | --- |
| `tlc-spec-driven`  | [`tech-leads-club/agent-skills`](https://github.com/tech-leads-club/agent-skills/blob/main/packages/skills-catalog/skills/%28development%29/tlc-spec-driven/SKILL.md) | `metadata.version: 3.3.0` (the upstream skill's own version field) |
| `tdd`               | [`mattpocock/skills`](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md) | repository release tag [`v1.2.3`](https://github.com/mattpocock/skills/releases/tag/v1.2.3). The `tdd` skill itself carries no `metadata.version`, so the repository's own release versioning is the closest available signal |

Both pins live machine-readably in `shared/baselines/registry.yml` as `upstream_version` (plus
`upstream_source` and `upstream_version_checked_at`) on each baseline entry, never only in
prose here. When the upstream skill/repository publishes a new version, update
`upstream_version` there first, then decide whether `shared/references/tlc-baseline.md` /
`tdd-baseline.md` need to follow, and record either outcome ("re-synced" or "reviewed, no
change needed") under a "Baseline changes" note in [CHANGELOG.md](../CHANGELOG.md).

## Internal implementation mapping

`saf-create-spec` owns Specify through Tasks. `saf-implement` and `saf-implement-multi`
implement the Execute intent. `saf-check-task` and `saf-validate` implement Verify. Direct TLC
Execute is not invoked. See the full mapping in
[architecture.md](architecture.md#capability-contracts).

## What the Baseline Compliance gate verifies

`doctor` checks `baseline-tlc`, `adaptive-sizing`, `traceability`, and `evidence-first`. These
are **presence and configuration checks**, not behavioral verification: `doctor` confirms the
shipped baseline files and quality-gate configuration are intact. It cannot observe whether an
agent actually followed Specify → Verify or recorded current adequate evidence in a given
session. That remains a human-review responsibility. Doctor does not verify that an agent
ran RED → GREEN → REFACTOR.

## Synchronization policy

When the external `tlc-spec-driven`/`tdd` skills change in ways that affect their public stages
or loop, this package's condensed baselines are updated deliberately and the change is called out
under a "Baseline changes" note in [CHANGELOG.md](../CHANGELOG.md), never silently.
