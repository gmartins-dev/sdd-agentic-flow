# Design — quiet-hours-notifications

## Decision

Keep quiet-hours as a per-user setting checked at notification-generation time, not at
delivery time: the record is always created immediately, and only its delivery timestamp is
deferred. This preserves "never silently drop a notification" without a new delivery
mechanism.

## Path ownership

- `src/notifications/` — quiet-hours window check and deferred-delivery timestamp.
- `src/settings/` — per-user quiet-hours window setting.
