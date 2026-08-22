# Task prompt — {{task_id}}

## Objective

{{objective}}

## Task slice

- Slice type: {{vertical | horizontal | non-code}}
- Independently verifiable: {{yes | no}}
- Public seam: {{public_seam_or_na}}
- Requirement anchors: {{requirement_anchors}}
- Dependencies: {{dependencies_or_none}}
- Horizontal-slice justification: {{justification_or_na}}
- Expand-contract strategy: {{strategy_or_na}}

## Repository context

{{repository_context}}

## Scope and authority

- Review boundary: {{review_boundary}}
- Expected touchpoints: {{expected_touchpoints}}
- Non-goals: {{non_goals}}
- Re-ground repository facts before editing. Expected touchpoints guide inspection; they are not authority to expand scope.

## Verification

{{verification}}

## Completion

{{completion_criteria}}

{{handoff_when_needed}}

## TDD baseline (when applicable)

- Behavior under test: {{behavior_under_test}}
- Public seam: {{public_seam}}
- Test strategy: {{test_strategy}}
<!--
Historical/diagnostic field only.
RED is not required and must not be fabricated.
Use n/a when RED is not meaningful or was not used as evidence.
-->
- Expected RED command: {{red_command}}
- Expected GREEN command: {{green_command}}
- Refactor scope: {{refactor_scope}}
- TDD limitations: {{tdd_limitations}}
<!--
Expected outcomes come from the spec (observable expected outcome per AC), not from the code.
When the work is a defect, include a reproduction sensor that fails on current code.
-->
