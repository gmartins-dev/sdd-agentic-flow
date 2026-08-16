# Feature validation — task-management

Status: ready

Feature: task-management

## Validation scope

Generic task-management golden example; notification transport out of scope.

## Evidence

| Requirement anchor | Sensor | Result | Freshness |
| --- | --- | --- | --- |
| REQ-1 | unit tests | fields and enum verified | current |
| REQ-2 | unit tests | transition matrix verified | current |
| REQ-3 | unit tests | notification records verified | current |
| REQ-4 | unit tests | invalid transition messages verified | current |

Command: npm test -- task.spec.ts transitions.spec.ts notifications.spec.ts
Exit status: 0
Observable result: required behaviors covered locally
Requirement mapping: REQ-1 through REQ-4

## Limitations

Notification transport is intentionally outside this generic example.

<!--
Rejected as **green-but-wrong** / **false success / self-assessment**: a
`Status: ready` that only restated the implementer's "all tests passed" narrative,
without re-deriving expected from spec ACs and re-running sensors, is illegitimate.
Self-report is not evidence. A catalog hit forbids Status: pass / Status: ready.

Rejected as **silent gap** on preservation: a bugfix marked ready with a
reproduction sensor but without **unchanged behavior** plus regression sensors
is incomplete. “Fixed” is not enough if what must keep working was never named.
-->
