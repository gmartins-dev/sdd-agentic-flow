# Specification — quiet-hours-notifications

## Requirement REQ-1: Configurable quiet-hours window

A user can set a quiet-hours window (start time, end time); it is off by default.

## Requirement REQ-2: Deferred delivery inside the window

A notification generated inside the user's active quiet-hours window is recorded immediately
and its delivery is deferred until the window ends; a notification generated outside the window
delivers immediately, unchanged from today.

## Acceptance criteria

- AC-1 (REQ-1): a user can set a quiet-hours window; it is off by default.
- AC-2 (REQ-2): a notification generated inside the window is recorded immediately, never
  discarded.
  Examples:
  - Given quiet hours 22:00-07:00, When a notification arrives at 23:30, Then it is recorded at
    23:30 and not delivered.
  - Forbidden: a notification generated inside the window is never dropped.
- AC-3 (REQ-2): a notification generated inside the window delivers only after the window ends.
- AC-4 (REQ-2): a notification generated outside the window delivers immediately.
