# Condensed vs. full TLC/TDD

`sdd-agentic-flow` ships condensed, self-contained adaptations of TLC and TDD. See
[TLC integration](../tlc-integration.md) for the exact boundary. Choose between this package's condensed baselines and the full external `tlc-spec-driven`/`tdd` skills they adapt from.

## Use this package's condensed baselines when

- You want a single toolkit that covers the whole SDD loop (specify through PR) with zero
  runtime dependencies and no sub-agent orchestration to configure.
- Your team wants presence/configuration checks (`doctor`'s Baseline Compliance gate) rather
  than a full behavioral verification system.
- You're adopting SDD practices for the first time and want the condensed version's smaller
  surface area: **Specify → Discuss → Design → Tasks → Execute → Verify** for planning, plain
  RED → GREEN → REFACTOR for implementation — without sub-agent delegation, a discrimination
  sensor, `LESSONS.md` distillation, or a Knowledge Verification Chain.
- You need every skill to stay agent-neutral and installable via simple file copy, not a runtime
  that invokes other skills on your behalf.

## Use the full external `tlc-spec-driven`/`tdd` skills when

- You need the full feature set the condensed baselines intentionally omit: sub-agent
  delegation, the Verifier's discrimination sensor, `LESSONS.md`-style distillation across
  sessions, the Knowledge Verification Chain, or `STATE.md`-based session continuity.
- Your workflow already depends on those skills' specific mechanics and you don't want a second,
  divergent implementation running alongside them.

## They are not mutually exclusive, but don't run both as your primary loop

`sdd-agentic-flow` does not install, invoke, or require either external skill — see
[inspirations](../inspirations.md), [NOTICE](../../NOTICE), and
[LICENSING.md](../../LICENSING.md) for attribution. If you install both, treat one as the
primary methodology skill for a given feature; don't split Specify/Design between them, since
their artifact shapes and stage names differ.

## What changes when the external skills change

This package's condensed baselines are updated deliberately, not automatically, when the
external skills change in ways that affect their public stages or loop — see the
[synchronization policy](../tlc-integration.md#synchronization-policy). A version bump here
never silently pulls in behavior from the external skills.
