# TDD baseline

`sdd-agentic-flow` uses the TLC baseline for planning and specifications. The TDD baseline governs implementation and testing work.

The canonical rules live in [shared/references/tdd-baseline.md](../shared/references/tdd-baseline.md). Skills load that file at install time. Read this doc for when the baseline applies and how it relates to external skills.

## Upstream inspiration

The baseline adapts the public `tdd` skill in `mattpocock/skills`. Attribution does not imply endorsement. The pinned upstream reference is release tag [`v1.2.3`](https://github.com/mattpocock/skills/releases/tag/v1.2.3). See [Baselines](baselines.md) for how this pin is tracked and updated.

## When it applies

Use the baseline when a task changes code or behavior. Documentation-only work can mark TDD fields as `N/A — non-code task` and provide appropriate evidence.

## Summary

The required loop is: name the behavior from the spec → place a sensor at the contractual seam → implement → record current evidence.

Three levels:

1. **Required** — adequate behavioral sensors at the contractual seam, plus recorded current evidence. Field label `Public seam` still means that seam; prefer public/observable when practical.
2. **Recommended** — test-first / scenarios before code when they sharpen the spec. This is not the RED → GREEN → REFACTOR ritual.
3. **Optional** — full TDD ritual when the human wants that granularity. Same-agent RED is not proof. `Expected RED command` may be `n/a`. Do not fabricate RED.

Tests and other sensors remain required as behavioral evidence. Test-first and TDD remain valid implementation strategies. This package does not claim test-first is inferior to test-last. Required behavioral coverage is not weakened because the ritual is optional.

A passing sensor is evidence, not a correctness verdict. The human remains the gate. See [evidence-standard.md](../shared/references/evidence-standard.md).

`quality.require_tdd: true` keeps its name. It means this evidence contract, not “RED → GREEN is mandatory.”

## Related docs

- [shared/references/tdd-baseline.md](../shared/references/tdd-baseline.md) — full baseline contract
- [workflow](workflow.md) — where TDD fits in the SDD loop
- [prompt-recipes](prompt-recipes.md) — prompt patterns for implementation tasks
