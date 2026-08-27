# Choosing a feature profile

`feature_profile` sizes SDD rigor to the **uncertainty and risk** of the work, not only the size
of the diff. It belongs to the feature package created by `saf-create-spec`, not normal
interactive setup. See
[feature profiles](../../shared/references/feature-profiles.md) for the full contract each
value implies, and [work types](../../shared/references/work-types.md) for inferred intent
(`feature` / `bugfix` / `refactor` / `investigation` / `maintenance`). Intent and profile are
independent axes. Do not add a fifth profile or a CLI `--type`.

Selection rule:

> Upsize when uncertainty or risk is high even if the diff is small.
> Downsize when the behavior is obvious and gates would be theater.
> The compatibility fallback remains `medium_feature`; normal feature creation infers depth.

An explicit `workflow.feature_profile` in valid project config is an advanced project-level
override. It is not the same as the effective built-in fallback, and workflow/language changes
must not create it implicitly.

Example: a 5-line change in authentication can be `medium_feature` or `large_feature`; a
500-line well-known CRUD can stay `small_fix` / `medium_feature`.

When inferred intent is **bugfix**, at **any** profile (not only `small_fix`), the spec
package must include current broken behavior, a **reproduction sensor** that fails on current
code, expected fixed behavior, **unchanged behavior** with regression sensors, root cause, and
fix boundary. “Fixed” without a current reproduction sensor is false success. “Fixed” without
unchanged behavior plus regression is a silent gap on preservation.

## `small_fix`

Use for a narrow, well-understood, low-uncertainty change where the desired behavior is already
obvious and there is no real design decision to record. A short inline `context.md`/`spec.md`
is enough; skip `design.md`. Spec analysis may skip only when the work is also well-understood;
record the skip.

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
Upsize when uncertainty or risk is high (even a small auth diff); downsize when the behavior is
obvious and extra gates would be theater. Getting it "slightly wrong" is low-cost: profiles
change how much of the TLC and TDD baselines a skill invokes explicitly, not the baselines
themselves.
