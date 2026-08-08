# Design — task-management

## Decision

Model tasks and notifications as local domain records. Keep transition validation next to
task state changes. Expose notification creation behind a local interface so a delivery
mechanism can be selected later without changing task rules.

## Path ownership

- `src/tasks/` — task entity, status transitions, and validation.
- `src/notifications/` — local notification records and the delivery interface.
