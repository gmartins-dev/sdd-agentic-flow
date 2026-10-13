# Artifact contracts

This reference owns persisted SAF/SDD artifact materializations with mechanically recognizable
landmarks. It is a structural contract and presence check, not a registry of every logical,
ephemeral, composite, or projection output. It remains a structural presence contract, not a
complete logical-information model.

Every SDD artifact this package's skills produce has an implicit structure, mirrored by
`shared/templates/*.template.md`. This file documents that structure explicitly so skills and
`doctor` can confirm an artifact's required sections are present without inventing a new schema
format. This is a presence check, not full-schema validation. It does not verify section
*content*, only that the required headers exist.

| Materialization | Logical kind | Producer | Consumers | Authority | Representation / landmarks |
| --- | --- | --- | --- | --- | --- |
| Feature spec package | `spec-package` | `saf-create-spec` | prompts, implement, check, validate | `spec.md` for requirements; `design.md` for approach; `tasks.md` for execution | Markdown file-set; required headings and stable `REQ-*`/task anchors |
| Task prompt | `task-prompts` | `saf-create-prompts` | implement | prompt artifact | Markdown; `# Task prompt`, task slice, anchors, and TDD baseline |
| Task check report | `check-report` | `saf-check-task` | multi, validate, graph | check report for the check result | Markdown; `Feature:`, evidence index with freshness, Evidence, TDD evidence |
| Feature validation report | `validation-report` | `saf-validate` | release handoff | validation report for the validation decision | Markdown; feature heading, Status, scope, evidence index, Evidence, TDD evidence |
| Change review package | `change-review-package` | `saf-create-pr` | review | local review package | Markdown; feature/task heading, Scope, Evidence |

- discovery-state: required `# Discovery — {feature_slug}`, top-line `Status:`, and
  `## Destination`, `## Current understanding`, `## Open investigations`, `## Findings`,
  `## Decisions`, `## Deferred uncertainty`, `## Out of scope`. It is not a spec package.

- `spec.md`: required `# Specification — {feature_slug}`, one `## Requirement REQ-{id}` per
  requirement (stable `REQ-*` identifiers), `## Acceptance criteria` (criteria MAY carry `AC-*` IDs). Produced by
  `saf-create-spec`.
- `design.md`: required when the artifact exists (optional for `small_fix`; see
  `feature-profiles.md`): `# Design — {feature_slug}`, `## Decision`, `## Path ownership`.
  Produced by `saf-create-spec`.
- `tasks.md`: required `# Tasks — {feature_slug}`, one `## {task_id}` per task (each with
  Acceptance criteria, Review boundary, Slice type, Independently verifiable, Public seam,
  **Requirement anchors** (`REQ-*` or `AC-*` fulfilled by the task), Dependencies (task-order only —
  never requirement fulfillment), Horizontal-slice justification, and Expand-contract strategy),
  plus nested `## TDD baseline` for code tasks. Produced by `saf-create-spec`.
- task-prompt: required `# Task prompt — {task_id}`, `## Task slice` including **Requirement
  anchors**, `## TDD baseline`. Produced by `saf-create-prompts`.
- check-report: required `# Task check — {task_id}`, top-line `Status:`, **`Feature:
  {feature_slug}`**, `## Validation scope`, evidence table:

  ```text
  | Requirement anchor | Sensor | Result | Freshness |
  ```

  Freshness is `current`, `historical`, `stale`, or `not-run`. Also `## Evidence` (detailed
  current evidence record per evidence-standard.md) and `## TDD evidence`. Produced by
  `saf-check-task`.
- validation-report: required `# Feature validation — {feature_slug}`, top-line `Status:`,
  `## Validation scope`, evidence table with anchor/sensor/result/freshness, `## Evidence`,
  `## TDD evidence`. Produced by `saf-validate`.
- change-review-package: required `# {feature_slug} — {task_id}`, `## Scope`, `## Evidence`.
  Produced by `saf-create-pr`.

## Requirement identity (v4 legacy and v1)

`REQ-*` identity is semantic, not presentation order:

- IDs are unique within a feature and are never reused for unrelated semantics.
- Rewording that preserves one requirement's identity preserves its ID.
- Requirement anchors in tasks/prompts reference fulfillment; task-order `Dependencies` never
  substitute for requirement fulfillment.

## Acceptance criterion identity

A criterion MAY carry a stable `AC-*` ID bound to exactly one parent requirement:

```markdown
## Acceptance criteria
- AC-01 (REQ-01): the pending counter drops by one when a pending task is completed.
  Examples:
  - Given 3 pending tasks, When the user completes one, Then the counter shows 2.
```

- The form is `- AC-<id> (REQ-<id>): <observable outcome>`. A line that starts like an AC but
  does not match is a diagnostic, never coverage.
- Identity follows the `REQ-*` rules: unique within the feature, never reused for unrelated
  semantics, and preserved when the wording is refined. Changing the expected outcome is a
  `contract correction` ([evidence-standard.md](evidence-standard.md#sensor-change-classes)),
  not a rewording.
- `Examples:` is optional. Given/When/Then is an optional notation; the observable outcome is
  the requirement. Confirm criteria in prose before writing examples.
- `Requirement anchors` in tasks, prompts, and `EV-*` records accept `AC-*` alongside `REQ-*`;
  an AC anchor implies its parent REQ. No new `EV-*` field exists.
- A feature without `AC-*` IDs is evaluated per requirement, exactly as before. With `AC-*`, a
  requirement is covered only when every one of its criteria has current evidence.

## Acceptance discovery and examples

Rules for turning intent into criteria before examples exist. They live here; skills cite them.

- Discovery is proportionate: one or two high-impact questions, none for an obvious `small_fix`.
- Organize findings as rules, examples, and questions (Example Mapping).
- Classify each open question as `blocker` or `assumption`. A `blocker` stops work and goes to a
  decision gate. An `assumption` is recorded as Inferred with an explicit default and appears in
  the `Given` of an example, never implicitly.
- An assumption that changes an expected outcome is Unknown and needs a decision gate; it does
  not become an acceptance criterion.
- Approval order is prose first: the human confirms criteria in natural language, then examples
  follow. Examples that look like tests turn review into a syntax check.
- A criterion with a security, permission, or data risk includes at least one example of what
  must **not** happen.
- No behavior without a criterion: an example, test, or implementation with no `AC-*` or `REQ-*`
  is orphan behavior and is reported, not silently kept.

## Traceability matrix

| Contract | Canonical producer | Consumers |
| --- | --- | --- |
| `REQ-*` identity | `saf-create-spec` | prompts, implement, check, validate, graph |
| `AC-*` identity (optional) | `saf-create-spec` | prompts, implement, check, validate, graph |
| Requirement anchors | `saf-create-spec` / `saf-create-prompts` | implement, multi, check, graph |
| Evidence index row + freshness | check/validation reports | multi, graph, handoff |
| `Feature:` task-check identity | `saf-check-task` | multi, validate, graph |

See [system-invariants.md](system-invariants.md), [bounded-execution.md](bounded-execution.md),
[task-context-package.md](task-context-package.md), and [decision-gates.md](decision-gates.md).

## Legacy optional convention (pre-v4)

Pre-v4 artifacts may omit `Feature:` and evidence tables; they remain human-readable history but
cannot satisfy v1 graph coverage. V1 reports add the evidence-contract v1 envelope, `Record IDs` in
the index, and directly joined `EV-*` evidence records; only their unambiguous active terminal can
satisfy current Evidence Graph coverage.
