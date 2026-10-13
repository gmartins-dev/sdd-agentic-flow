# Acceptance-driven development

SAF is Spec-Driven Development. It borrows the useful parts of acceptance-test-driven (ATDD),
behavior-driven (BDD), and test-driven (TDD) development, and adds nothing that needs a runner.
This page explains how the pieces relate and what v8.4.0 adds to make acceptance criteria
traceable. Canonical rules live in
[artifact-contracts.md](../shared/references/artifact-contracts.md) and
[evidence-standard.md](../shared/references/evidence-standard.md).

## How the disciplines map

| Idea | Where it lives in SAF |
| --- | --- |
| Humans decide what must be true | `spec.md`: requirements and acceptance criteria, confirmed by a human |
| Concrete examples sharpen a criterion | Optional `Examples:` under an acceptance criterion |
| Executable acceptance checks bind the agent | Sensors at a contractual seam, recorded as `EV-*` evidence |
| Test-first as an implementation strategy | Optional; RED is never proof ([TDD baseline](tdd-baseline.md)) |
| Why → what → how | `saf-brainstorm` (why) → `spec.md` (what) → `design.md` and `tasks.md` (how) |

SAF does not require Gherkin, `.feature` files, or a specific test framework. A project that
already uses Gherkin can tag scenarios with the criterion ID, for example `@AC-01`; SAF does not
verify that tag.

## Acceptance criterion identity

A criterion may carry a stable ID bound to exactly one requirement:

```markdown
## Acceptance criteria

- AC-01 (REQ-01): marking a pending task complete lowers the pending counter by one.
  Examples:
  - Given 3 pending tasks, When the user completes one, Then the counter shows 2.
```

Task anchors, prompts, and evidence records may cite `AC-*` in the existing `Requirement anchors`
field, and an `AC-*` anchor implies its parent requirement. IDs are unique in a feature and are
never reused. Without `AC-*` IDs everything works per requirement, exactly as before.

Given/When/Then is optional notation. The required part is the observable outcome. Confirm the
criteria in prose first; write examples afterwards, because examples that look like tests turn
review into a syntax check. A criterion with a security, permission, or data risk includes one
example of what must not happen.

## Coverage per criterion

`npx sdd-agentic-flow doctor --evidence-graph <feature>` lists each criterion under its
requirement when the spec uses `AC-*` IDs, in text, `--json` (`acceptance_criteria`), and
`--html`. A requirement is covered only when all of its criteria are. These edges exit `1`:

| Edge | Meaning |
| --- | --- |
| `duplicate-ac-id` | The same `AC-*` ID is declared twice |
| `ac-unknown-requirement` | The criterion names a requirement the spec does not declare |
| `unknown-ac-anchor` | A task anchors an `AC-*` that the spec does not declare |
| `no-ac-evidence` | The criterion has no current passing evidence |

A line that looks like a criterion but does not match the form is reported as
`malformed AC line` and never counts as coverage.

## Changing a sensor that encodes a criterion

A sensor that encodes an approved criterion is the frozen expectation. Changes to it are
classified:

| Class | Allowed |
| --- | --- |
| `infrastructure repair` | Yes: setup, fixture, environment, selector, timing |
| `automation repair` | Yes: how the approved behavior is exercised |
| `contract correction` | Only after a human decision gate and a spec update |
| `contract weakening` | No: it forbids `pass` and `ready` |

This separates repairing a test from quietly changing what the test demands. Check and review
also flag orphan behavior, meaning code or tests with no criterion.

## What SAF deliberately does not do

- It does not prescribe the TDD ritual. One published agent-loop experiment (small sample, LLM judge)
  found no visible quality gain from prescribing red-green-refactor at a much higher token cost.
  SAF treats that as weak evidence, not proof, and keeps RED optional and never proof. When RED is recorded, its cause is labeled so a broken test is not
  mistaken for missing behavior.
- It does not run tests, mutate code, or add a verifier model. The CLI diagnoses; skills verify.
- It does not claim improved agent behavior. The v8.4.0 fixtures prove a check can tell repair
  from contract change; a real-host campaign is a separate decision.

## Related

- [SDD methodology](sdd-methodology.md)
- [TDD baseline](tdd-baseline.md)
- [Skill behavior evaluation](skill-behavior-evaluation.md)
- [Commands](commands.md)
