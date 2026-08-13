# Validation report

## Evidence

- Creation and assignment satisfy required fields.
- Valid and invalid status transitions are covered.
- Assignment and due-soon notifications are verified locally.

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
