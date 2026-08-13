# Tasks — task-management

<!-- Each code task nests its own "## TDD baseline" section, per
     shared/references/artifact-contracts.md and shared/templates/tasks.template.md. -->
<!-- markdownlint-disable MD024 -->

## T1: Define task fields and status enum

Acceptance criteria: A task has title, assignee, due date, and status; status is one of
`todo`, `in_progress`, `done`, `cancelled`.

Review boundary: `src/tasks/task.ts` only.

Slice type: vertical

Independently verifiable: yes

Public seam: `createTask(input)`

Dependencies: none

Horizontal-slice justification: n/a

Expand-contract strategy: n/a

## TDD baseline

- Behavior under test: `createTask` accepts required fields and rejects an invalid initial status.
- Public seam: `createTask(input)`
- Test strategy: unit test at the entity boundary
<!--
Historical/diagnostic field only.
RED is not required and must not be fabricated.
Use n/a when RED is not meaningful or was not used as evidence.
-->
- Expected RED command: n/a — not used as proof
- Expected GREEN command: `npm test -- task.spec.ts`
- Refactor scope: extract field validation helpers only
- TDD limitations: none

## T2: Enforce status transitions

Acceptance criteria: Status changes follow `todo -> in_progress -> done` or
`todo -> cancelled`; any other transition is rejected with an actionable message.

Review boundary: `src/tasks/transitions.ts` only.

Slice type: vertical

Independently verifiable: yes

Public seam: `transitionTask(task, nextStatus)`

Dependencies: T1

Horizontal-slice justification: n/a

Expand-contract strategy: n/a

## TDD baseline

- Behavior under test: `transitionTask` allows valid transitions and rejects invalid ones with a message naming the attempted transition.
- Public seam: `transitionTask(task, nextStatus)`
- Test strategy: unit test at the entity boundary
<!--
Historical/diagnostic field only.
RED is not required and must not be fabricated.
Use n/a when RED is not meaningful or was not used as evidence.
-->
- Expected RED command: n/a — not used as proof
- Expected GREEN command: `npm test -- transitions.spec.ts`
- Refactor scope: table-drive the transition matrix
- TDD limitations: none

## T3: Record assignment and due-soon notifications

Acceptance criteria: Assigning a task records an assignment notification; a task due within
one day records a due-soon notification.

Review boundary: `src/notifications/` only.

Slice type: vertical

Independently verifiable: yes

Public seam: `notifyOnAssignment(task)`, `notifyIfDueSoon(task, now)`

Dependencies: T1

Horizontal-slice justification: n/a

Expand-contract strategy: n/a

## TDD baseline

- Behavior under test: assignment and due-soon checks each record exactly one notification record of the correct type.
- Public seam: `notifyOnAssignment(task)`, `notifyIfDueSoon(task, now)`
- Test strategy: unit test against the local notification interface (no delivery mechanism)
<!--
Historical/diagnostic field only.
RED is not required and must not be fabricated.
Use n/a when RED is not meaningful or was not used as evidence.
-->
- Expected RED command: n/a — not used as proof
- Expected GREEN command: `npm test -- notifications.spec.ts`
- Refactor scope: none
- TDD limitations: delivery mechanism is out of scope; only local record creation is tested
