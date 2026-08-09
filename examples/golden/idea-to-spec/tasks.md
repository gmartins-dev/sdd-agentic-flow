# Tasks — quiet-hours-notifications

<!-- Each code task nests its own "## TDD baseline" section, per
     shared/references/artifact-contracts.md and shared/templates/tasks.template.md. -->
<!-- markdownlint-disable MD024 -->

## T1: Add per-user quiet-hours setting

Acceptance criteria: A user can set a quiet-hours window (start time, end time); it is off by
default.

Review boundary: `src/settings/` only.

Slice type: vertical

Independently verifiable: yes

Public seam: `setQuietHours(userId, window)`

Dependencies: none

Horizontal-slice justification: n/a

Expand-contract strategy: n/a

## TDD baseline

- Behavior under test: `setQuietHours` stores a window and defaults to off when never set.
- Public seam: `setQuietHours(userId, window)`
- Test strategy: unit test at the settings boundary
- Expected RED command: `npm test -- quiet-hours-setting.spec.ts` (fails: `setQuietHours` not implemented)
- Expected GREEN command: `npm test -- quiet-hours-setting.spec.ts`
- Refactor scope: none
- TDD limitations: none

## T2: Defer notification delivery inside the quiet-hours window

Acceptance criteria: A notification generated inside the user's active quiet-hours window is
recorded immediately and delivers only after the window ends; one generated outside the window
delivers immediately.

Review boundary: `src/notifications/` only.

Slice type: vertical

Independently verifiable: yes

Public seam: `recordNotification(userId, notification, now)`

Dependencies: T1

Horizontal-slice justification: n/a

Expand-contract strategy: n/a

## TDD baseline

- Behavior under test: a notification generated inside the window is recorded with a deferred
  delivery timestamp at the window's end; one outside the window is recorded with an immediate
  delivery timestamp.
- Public seam: `recordNotification(userId, notification, now)`
- Test strategy: unit test against the local notification record (no delivery mechanism)
- Expected RED command: `npm test -- quiet-hours-delivery.spec.ts` (fails: deferral not implemented)
- Expected GREEN command: `npm test -- quiet-hours-delivery.spec.ts`
- Refactor scope: none
- TDD limitations: delivery mechanism itself is out of scope; only the record's delivery
  timestamp is tested
