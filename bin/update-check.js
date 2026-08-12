'use strict';

// Opt-in npm registry version check (v1.4.0; structured fields for v1.13.0 upgrade).
// Network entry points are documented in docs/trust-model.md — never runs on bare welcome
// unless the human answers yes to the interactive ask. Makes exactly one bounded-timeout
// request and never throws or hangs. Offline/unreachable is NOT "up to date".
// Uses Node's built-in global `fetch` (engines >=22). Manually managed AbortController
// timer (ref'd) so the process cannot exit before the timeout fires.

const { compareVersions } = require('./version-compat');

const DEFAULT_REGISTRY_URL = 'https://registry.npmjs.org/sdd-agentic-flow/latest';
const DEFAULT_TIMEOUT_MS = 3000;

function buildUpdateResult(currentVersion, latest) {
  const cmp = compareVersions(currentVersion, latest);
  if (cmp === null) throw new Error('malformed version string');
  if (cmp < 0) {
    return {
      name: 'update_check',
      status: 'WARN',
      message: `update available: ${currentVersion} -> ${latest}. Run \`sdd-agentic-flow upgrade\`.`,
      section: 'Package updates',
      currentVersion,
      latest,
      updateAvailable: true,
      reachable: true,
    };
  }
  return {
    name: 'update_check',
    status: 'PASS',
    message: `up to date (${currentVersion})`,
    section: 'Package updates',
    currentVersion,
    latest,
    updateAvailable: false,
    reachable: true,
  };
}

async function checkForUpdate({
  currentVersion,
  fetchImpl = fetch,
  // Internal, undocumented test-only seams — see test/cli.test.js.
  registryUrl = process.env.SDD_AGENTIC_FLOW_TEST_REGISTRY_URL || DEFAULT_REGISTRY_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  // When set, skip network entirely (sandbox-safe). Prefer over loopback stub servers.
  testLatestVersion = process.env.SDD_AGENTIC_FLOW_TEST_LATEST_VERSION,
} = {}) {
  if (testLatestVersion === 'offline') {
    return {
      name: 'update_check',
      status: 'INFO',
      message: 'could not check for updates (offline or registry unreachable)',
      section: 'Package updates',
      currentVersion,
      latest: null,
      updateAvailable: false,
      reachable: false,
    };
  }
  if (typeof testLatestVersion === 'string' && testLatestVersion.length) {
    try {
      return buildUpdateResult(currentVersion, testLatestVersion);
    } catch {
      return {
        name: 'update_check',
        status: 'INFO',
        message: 'could not check for updates (offline or registry unreachable)',
        section: 'Package updates',
        currentVersion,
        latest: null,
        updateAvailable: false,
        reachable: false,
      };
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(registryUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`registry responded ${response.status}`);
    const body = await response.json();
    const latest = typeof body?.version === 'string' ? body.version : null;
    if (!latest) throw new Error('malformed registry response');
    return buildUpdateResult(currentVersion, latest);
  } catch {
    return {
      name: 'update_check',
      status: 'INFO',
      message: 'could not check for updates (offline or registry unreachable)',
      section: 'Package updates',
      currentVersion,
      latest: null,
      updateAvailable: false,
      reachable: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { checkForUpdate, DEFAULT_REGISTRY_URL };
