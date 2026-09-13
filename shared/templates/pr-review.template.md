# Change review — {{task_id}}

- Status: {{approved | changes requested | blocked | inconclusive}}
- Review context: {{package_task_base_head_spec_config_revision_and_dirty_diff_identity}}
- Round: {{round}}
- Previous review: {{reference_or_none}}

## Findings

| finding_id | State | Severity / impact | Location | Evidence | Required remediation | Re-review focus |
| --- | --- | --- | --- | --- | --- | --- |
| {{stable_id}} | {{existing_finding_state}} | {{impact}} | {{file_line_or_artifact_section}} | {{typed_evidence_references}} | {{fix_or_evidence_needed}} | {{verification}} |

Use `none` for an empty ledger. Apply the [review protocol](../references/reviewability.md).

### Resolution (rounds after the first)

| finding_id | Previous state | Current state | Evidence / reason | Next action |
| --- | --- | --- | --- | --- |
| {{prior_id}} | {{previous_state}} | {{current_state}} | {{current_evidence_or_gap}} | {{next_action_or_none}} |

## Evidence

{{evidence}}

Record `internal`, `repro`, or `external` evidence with revision/input identity, observed result,
and freshness; distinguish unavailable checks from failures. Remove the resolution section in
round one. Include all prior IDs in later rounds, even when resolved or deferred.

- Next recommended skill: {{skill_or_none}}
- Reason: {{reason}}
