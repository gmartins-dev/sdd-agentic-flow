# Feature profiles

`feature_profile` adaptively sizes SDD rigor to the **uncertainty and risk** of the work, not
only the size of the diff. It is a property of the work package, not a preference that silently
sizes every future feature. Skills that consume this value scale specification depth, task
granularity, and evidence rigor accordingly; the underlying TLC and TDD baselines never change.

The canonical writer, `saf-create-spec`, owns classification and reassessment. It records the
result in the feature package context using these exact fields:

```text
Feature profile: <small_fix|medium_feature|large_feature|epic>
Feature profile source: <inferred|explicit-override>
Profile rationale: <concise explanation>
```

Resolution precedence:

1. During an intentional create or update, a physically present valid
   `workflow.feature_profile` in project config is an `explicit-override`.
2. Without that field, `saf-create-spec` infers from the current request and repository
   evidence and records `inferred`. A prior persisted value is history during this rewrite.
3. Downstream skills use the persisted context field first, then an explicit legacy config
   field, then `medium_feature` as a compatibility fallback. They never infer independently.

An effective built-in `medium_feature` is not an explicit override and must not be materialized
by an unrelated workflow or language mutation.

Selection rule:

> Upsize when uncertainty or risk is high even if the diff is small.
> Downsize when the behavior is obvious and gates would be theater.
> The compatibility fallback remains `medium_feature`; normal feature creation infers depth.

Example: a 5-line change in authentication can be `medium_feature` or `large_feature`; a
500-line well-known CRUD can stay `small_fix` / `medium_feature`. Same artifact family, variable
ceremony — not a second file format.

Work **intent** (`feature` / `bugfix` / `refactor` / `investigation` / `maintenance`) is a
separate axis; see [work-types.md](work-types.md). Do not collapse intent into a fifth
`feature_profile` value.

When inferred intent is **bugfix**, at **any** profile (not only `small_fix`), the spec package
includes: current broken behavior; a **reproduction sensor** that fails on current code;
expected fixed behavior; **unchanged behavior** with regression sensors; root cause; fix
boundary. “Fixed” without a current reproduction sensor is false success. “Fixed” without
unchanged behavior plus regression sensors is a silent gap on preservation. This is a content
contract, not a fifth profile and not a CLI `--type`.

- `small_fix`: narrow, well-understood, low-uncertainty change. A short inline
  `context.md`/`spec.md` is acceptable; skip `design.md` unless a decision needs recording.
  Tasks stay as a single vertical slice. Evidence: one focused current sensor command for the
  changed behavior at its contractual seam. Spec analysis (see `saf-create-spec`) may skip
  only when the work is also well-understood; record the skip.
- `medium_feature`: default. Full `context.md`/`spec.md`/`tasks.md`; add `design.md` only when
  there is a real decision to record. Tasks are vertically sliced. Evidence: current
  passing-sensor command(s) per slice plus any directly related broader checks. RED is
  optional and diagnostic; do not weaken required behavioral coverage.
- `large_feature`: multi-task, cross-cutting, or high-uncertainty/high-risk change. Full spec
  package including `design.md` with explicit dependency waves in `tasks.md`. Evidence: current
  passing-sensor command(s) per slice plus integration-level checks before `saf-validate`.
- `epic`: spans multiple features or a long-lived initiative. Full spec package, explicit
  decomposition into feature-sized sub-scopes, and validation gates enforced per sub-scope
  rather than deferred to the end.

Semantic classification is not a CLI certification responsibility. CLI certification verifies
the human shell, persistence, advanced override behavior, and absence of implicit profile
materialization. Classification quality is validated by the actual Agent Skill execution and
the normal SDD review/validation chain; do not create a duplicate runtime classifier solely for
the CLI certifier.
