# Feature profiles

`workflow.feature_profile` in `.sdd/config.yml` adaptively sizes SDD rigor to the scope of the
work. Skills that read this value scale specification depth, task granularity, and evidence
rigor accordingly; the underlying TLC and TDD baselines never change, only how much of them is
invoked explicitly. Unset or unrecognized values fall back to `medium_feature` behavior.

- `small_fix` — narrow, low-risk change. A short inline `context.md`/`spec.md` is acceptable;
  skip `design.md` unless a decision needs recording. Tasks stay as a single vertical slice.
  Evidence: one focused test command for the changed behavior.
- `medium_feature` — default. Full `context.md`/`spec.md`/`tasks.md`; add `design.md` only when
  there is a real decision to record. Tasks are vertically sliced. Evidence: RED/GREEN per slice
  plus any directly related broader checks.
- `large_feature` — multi-task, cross-cutting change. Full spec package including `design.md`
  with explicit dependency waves in `tasks.md`. Evidence: RED/GREEN per slice plus
  integration-level checks before `sdd-validation`.
- `epic` — spans multiple features or a long-lived initiative. Full spec package, explicit
  decomposition into feature-sized sub-scopes, and validation gates enforced per sub-scope
  rather than deferred to the end.
