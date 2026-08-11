# Choosing a feature profile

`workflow.feature_profile` in `.sdd-agentic-flow/config.yml` sizes SDD rigor to the scope of the
work. See [feature profiles](../../shared/references/feature-profiles.md) for the full
contract each value implies. Pick the value that fits the piece of work.

## `small_fix`

Use for a narrow, low-risk change where the desired behavior is already obvious and there is no
real design decision to record. A short inline `context.md`/`spec.md` is enough; skip
`design.md`.

Examples: fixing a typo in a user-facing error message, correcting an off-by-one in a pagination
helper, adding a missing null check flagged by a bug report with a clear repro.

## `medium_feature` (default)

Use for typical feature work: a new endpoint, a new UI flow, a behavior change that touches a
handful of files but doesn't reshape module boundaries. Full `context.md`/`spec.md`/`tasks.md`;
add `design.md` only if there's an actual decision worth recording (e.g., "why polling instead
of websockets here").

Examples: adding a "duplicate project" action, adding rate limiting to one API route, migrating
one component from a deprecated library to its replacement.

## `large_feature`

Use for multi-task, cross-cutting change — new functionality that spans multiple modules or
requires sequencing (task B can't start until task A's public seam exists). Always produce
`design.md` with explicit dependency waves in `tasks.md`.

Examples: adding a permissions system that multiple existing features need to check against,
introducing a new persistence layer alongside the old one during a migration, building a
multi-step onboarding flow with several interdependent screens.

## `epic`

Use when the work spans multiple features or is a long-lived initiative that will itself get
decomposed into feature-sized pieces, each separately validated rather than validated once at
the very end.

Examples: replacing the authentication provider across an entire application, a multi-quarter
initiative to make a monolith's core domain testable in isolation.

## If you're unsure

Default to `medium_feature` — it's the config's own fallback for unset or unrecognized values.
Move up to `large_feature` only once you notice the work genuinely needs sequencing or
cross-cutting design decisions; move down to `small_fix` only when you're confident there's
nothing to design. Getting it "slightly wrong" is low-cost: profiles change how much of the TLC
and TDD baselines a skill invokes explicitly, not the baselines themselves.
