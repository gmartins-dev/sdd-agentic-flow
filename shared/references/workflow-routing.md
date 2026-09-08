# Workflow routing

Use this reference to recommend a local SDD next step. It is guidance, not automatic invocation: read the candidate `SKILL.md` before acting.

## Routing matrix

| Situation | Recommended skill |
| --- | --- |
| No `.sdd-agentic-flow/config.yml` | Continue with effective defaults as a read-only prelude; resolve the final route from the artifact state. |
| Idea, problem, outcome, or consequential product direction is not yet defined | `saf-brainstorm` (durable mode for persistent investigations) |
| Discovery-only workspace | `saf-brainstorm` to resume or converge; not implementation-ready |
| Existing undocumented code needing specs | `saf-create-spec` (existing-code mode with an explicit bounded scope) |
| Ready spec without task prompts | `saf-create-prompts` |
| One eligible ready task | `saf-implement` |
| Multiple approved tasks with dependencies | `saf-implement-multi` |
| Completed task | `saf-check-task` |
| Completed change needing a PR package | `saf-create-pr` |
| Change ready for review | `saf-review-pr` |
| Accepted review findings | `saf-fix-pr`, then `saf-review-pr` |
| Integrated feature | `saf-validate` |

## Discovery versus specification

Recommend `saf-brainstorm` when formulating requirements would require the user or an authority to choose the problem, desired outcome, or consequential product direction. A missing technical approach, acceptance-criteria wording, or non-blocking implementation detail does not require discovery when the outcome is bounded and requirements can be made observable.

Recommend `saf-create-spec` when the requested outcome is bounded enough to formulate observable requirements from the available intent and evidence. The specification step may derive acceptance criteria, record open questions, and make non-blocking design decisions within that outcome.

If the evidence cannot distinguish these cases, or the required decision lacks authority, request a human decision. This rule is normative guidance with examples; it is not a natural-language classifier.

## Precedence and gates

Route first by state and explicit identity, then by uncertainty:

1. Resolve configuration by reading the existing file or effective defaults. Do not create configuration to represent its absence.
2. Resolve the package or task identity required by the request. Inspect the relevant artifacts and prerequisites before recommending the next step. Identity does not imply readiness.
3. Preserve an explicit package or task reference. If it is missing, ambiguous, or not eligible, do not substitute another identity by approximation.
4. Consequential human judgment, unresolved authority, or multiple plausible package identities is a human gate.

Routing recommends only. It does not install bundles, change files, invoke the next Skill, bypass human decisions, or turn a passing sensor into a correctness verdict.
