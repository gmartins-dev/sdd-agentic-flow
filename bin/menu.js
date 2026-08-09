'use strict';

// Pure, side-effect-free pieces of the bare-invocation interactive menu (v1.4.0 CLI UX). No
// readline/process I/O lives here on purpose: spawnSync (what every existing E2E test uses)
// never provides a real TTY, so the actual keypress-to-action loop can't be exercised by an
// automated subprocess test — this module exists so the two decisions that matter (whether to
// show the menu at all, and what a given keystroke does) are still fully, deterministically
// unit-testable in isolation. See bin/sdd-agentic-flow.js's runInteractiveMenu() for the glue.

function shouldShowInteractiveMenu(streams = {}, env = {}) {
  return Boolean(streams.stdout?.isTTY) && Boolean(streams.stdin?.isTTY) && !env.CI;
}

// `command` is the exact argv tail the CLI's own dispatch already understands — the menu is
// never a second implementation of command behavior, only a router onto it. The uninstall entry
// is deliberately, structurally `--plan` only (never `--apply`): a dedicated test asserts this
// literal array entry directly, so a future edit can't accidentally wire a destructive default.
const MENU_ACTIONS = [
  { label: 'Create local configuration', command: ['init'] },
  { label: 'Install the core skill pack', command: ['install', 'core'] },
  { label: 'Validate local setup', command: ['doctor'] },
  { label: 'Refresh auto-discovered project context', command: ['discover', '--force'] },
  { label: 'Preview what uninstall would remove (read-only)', command: ['uninstall', '--plan'] },
  { label: 'Show full command reference', command: ['help'] },
];

// Unifies every "no action" case (empty input, '0', 'q'/'Q', out-of-range, non-numeric) into a
// single null return — pressing Enter with nothing, '0', or 'q' must exit cleanly, and so must
// any other input that isn't a clean, in-range selection. No retry loop by design.
function resolveMenuSelection(rawInput, actions = MENU_ACTIONS) {
  const trimmed = String(rawInput ?? '')
    .trim()
    .toLowerCase();
  if (trimmed === '' || trimmed === '0' || trimmed === 'q') return null;
  const index = Number(trimmed);
  if (!Number.isInteger(index) || index < 1 || index > actions.length) return null;
  return actions[index - 1];
}

module.exports = { shouldShowInteractiveMenu, MENU_ACTIONS, resolveMenuSelection };
