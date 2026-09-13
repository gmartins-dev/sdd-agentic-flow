# Prompt authoring standard

`task-context-package.md` owns the semantic payload. This file defines its execution-prompt encoding; `task-prompt.template.md` owns Markdown shape and `artifact-contracts.md` owns structural presence checks.

Prompts state objective, requirement/acceptance anchors, repository context, constraints, scope boundary, expected touchpoints, public seam, non-goals, authority, verification, completion, and handoff when needed. Expected touchpoints guide inspection; they do not authorize scope expansion or prohibit re-grounding.

Do not prescribe a provider tool, hidden reasoning, persona, status cadence, mandatory subagent, or implementation recipe not required by the specification. Use TDD fields only for applicable code tasks.

Encode the task-context classes as explicit read conditions: MUST READ for the task's binding
inputs, READ WHEN RELEVANT for conditional detail, and DO NOT PRELOAD for unrelated context.
Keep the objective, acceptance outcomes, scope, authority, and completion understandable without
prior conversation; link extensive design and evidence instead of copying them. A pointer must
say when to read its target, and must not hide a prerequisite behind an optional condition.

Keep requirement anchors separate from task dependencies. Apply the obligation and coverage
guidance in [evidence-standard.md](evidence-standard.md#requirement-coverage); do not invent a
test command when only a candidate sensor is known. Use the existing handoff contract only for
non-terminal continuity, with pointers to canonical artifacts rather than duplicate authority.
