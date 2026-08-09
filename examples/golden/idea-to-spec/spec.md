# Specification — quiet-hours-notifications

## Requirement REQ-1: Configurable quiet-hours window

A user can set a quiet-hours window (start time, end time); it is off by default.

## Requirement REQ-2: Deferred delivery inside the window

A notification generated inside the user's active quiet-hours window is recorded immediately
and its delivery is deferred until the window ends; a notification generated outside the window
delivers immediately, unchanged from today.

## Acceptance criteria

- A user can set a quiet-hours window; it is off by default.
- A notification generated inside the window is recorded immediately, never discarded.
- A notification generated inside the window delivers only after the window ends.
- A notification generated outside the window delivers immediately.
