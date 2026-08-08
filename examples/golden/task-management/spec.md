# Specification — task-management

## Requirement REQ-1: Task lifecycle fields

A task has title, assignee, due date, and status.

## Requirement REQ-2: Status transitions

Status changes follow `todo -> in_progress -> done` or `todo -> cancelled`; any other
transition is rejected with an actionable message.

## Requirement REQ-3: Assignment notification

Assigning a task records an assignment notification.

## Requirement REQ-4: Due-soon notification

A task due within one day records a due-soon notification.

## Acceptance criteria

- A task has title, assignee, due date, and status.
- Status changes follow `todo -> in_progress -> done` or `todo -> cancelled`.
- Assigning a task records an assignment notification.
- A task due within one day records a due-soon notification.
- Invalid transitions are rejected with an actionable message.
