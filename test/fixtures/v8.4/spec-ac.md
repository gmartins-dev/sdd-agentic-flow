# Specification — ac-feature

## Requirement REQ-1 — Complete a task

Marking a pending task complete updates the pending counter.

## Acceptance criteria

- AC-1 (REQ-1): completing a pending task lowers the pending counter by one.
  Examples:
  - Given 3 pending tasks, When the user completes one, Then the counter shows 2.
- AC-2 (REQ-1): completion persists after the list reloads.
