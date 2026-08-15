# Brief — quiet-hours-notifications

## Problem

Notifications fire at any hour, including overnight, and users have started muting the app
entirely rather than tolerating the interruptions — which also hides the notifications they do
want.

## Why it matters

Complete muting means urgent, user-initiated notifications (like a direct assignment) are
missed too, not just the noisy ones. The real problem is timing, not notification volume.

## Constraints

- No new delivery provider or infrastructure — this reuses the existing local notification
  record from `src/notifications/`.
- Must not silently drop a notification; a suppressed one is deferred, not discarded.

## Decided approach

Add a per-user configurable quiet-hours window. A notification generated inside that window is
recorded immediately (so nothing is lost) but its delivery is deferred until the window ends.
Notifications generated outside the window deliver immediately, unchanged from today.

## Open questions for saf-create-spec

- Exact default quiet-hours window (proposed: none — opt-in only, off by default).
- Whether deferred notifications should batch into one delivery or send individually when the
  window ends.
