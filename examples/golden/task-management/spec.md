# Specification

## Acceptance criteria

- A task has title, assignee, due date, and status.
- Status changes follow `todo -> in_progress -> done` or `todo -> cancelled`.
- Assigning a task records an assignment notification.
- A task due within one day records a due-soon notification.
- Invalid transitions are rejected with an actionable message.
