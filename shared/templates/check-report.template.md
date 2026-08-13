# Task check — {{task_id}}

Status: {{status}}

## Evidence

<!--
Distinguish current vs historical vs not-run.
A passing sensor is evidence, not a correctness verdict.
Missing RED is not an automatic fail; n/a is valid and must not be fabricated.
A false-positive class hit forbids Status: pass / Status: ready.
Classes: Tautological oracle; Error propagation; Green-but-wrong; Shallow sensor;
Stale evidence; Silent gap; False success / self-assessment; Inherited author narrative;
Suite weakening; Completion theater.
Self-report is not evidence. Record requirement → sensor → current result.
-->
{{evidence}}

## TDD evidence

- Behavior tested: {{behavior_tested}}
- Seam: {{public_seam}}
- RED: {{red_evidence}}
- GREEN: {{green_evidence}}
- REFACTOR: {{refactor_evidence}}
- Broader checks: {{broader_checks}}
- Limitations: {{tdd_limitations}}
