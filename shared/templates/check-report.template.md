# Task check — {{task_id}}

Status: {{status}}

Feature: {{feature_slug}}

Evidence contract: saf-evidence/v1
Report ID: {{uuid_v4}}
Report scope: check:{{feature_slug}}:{{task_id}}
Supersedes: {{none_or_report_id}}

## Validation scope

<!-- Record impact, obligations, selected sensors, and omitted sensors with reasons. -->
{{validation_scope}}

## Evidence

<!--
Distinguish current vs historical vs not-run.
A passing sensor is evidence, not a correctness verdict.
Record requirement → sensor → current result in the table below AND detailed evidence prose.
-->

| Requirement anchor | Sensor | Record IDs | Result | Freshness |
| --- | --- | --- | --- | --- |
| {{requirement_anchor}} | {{sensor}} | {{record_ids}} | {{result}} | {{freshness}} |

{{evidence}}

## Evidence records

{{v1_evidence_records}}

## TDD evidence

- Behavior tested: {{behavior_tested}}
- Seam: {{public_seam}}
- RED: {{red_evidence}}
- GREEN: {{green_evidence}}
- REFACTOR: {{refactor_evidence}}
- Broader checks: {{broader_checks}}
- Limitations: {{tdd_limitations}}
