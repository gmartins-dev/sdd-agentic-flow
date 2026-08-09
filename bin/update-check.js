'use strict';

// Opt-in-only npm registry version check (v1.4.0 CLI UX). This is the sole, explicit exception
// to the "no outbound CLI network access by default" promise in docs/trust-model.md: it only
// runs when `doctor --check-updates` is passed, makes exactly one bounded-timeout request, and
// never throws or hangs — any failure (offline, non-2xx, malformed body, timeout) degrades to an
// informational row rather than affecting doctor's overall PASS/WARN/FAIL status or exit code.
// Uses Node's built-in global `fetch`/`AbortSignal.timeout` (stable since Node 18, and this
// package's `engines` already requires >=22) — no runtime dependency added.

const { compareVersions } = require('./version-compat');

const DEFAULT_REGISTRY_URL = 'https://registry.npmjs.org/sdd-agentic-flow/latest';
const DEFAULT_TIMEOUT_MS = 3000;

async function checkForUpdate({
  currentVersion,
  fetchImpl = fetch,
  // Internal, undocumented test-only seam (mirrors other test-only overrides already used
  // elsewhere in this package, e.g. install()'s homeDir option) — lets test/cli.test.js point a
  // real spawned CLI process at a local stub server instead of the real npm registry. Never
  // documented in README/docs; an explicit registryUrl argument always wins over it.
  registryUrl = process.env.SDD_AGENTIC_FLOW_TEST_REGISTRY_URL || DEFAULT_REGISTRY_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  try {
    const response = await fetchImpl(registryUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`registry responded ${response.status}`);
    const body = await response.json();
    const latest = typeof body?.version === 'string' ? body.version : null;
    if (!latest) throw new Error('malformed registry response');
    const cmp = compareVersions(currentVersion, latest);
    if (cmp === null) throw new Error('malformed version string');
    if (cmp < 0) {
      return {
        name: 'update_check',
        status: 'WARN',
        message: `update available: ${currentVersion} -> ${latest}. Run \`npm install -g sdd-agentic-flow@latest\` (or use \`npx sdd-agentic-flow@latest\`).`,
        section: 'Package updates',
      };
    }
    return {
      name: 'update_check',
      status: 'PASS',
      message: `up to date (${currentVersion})`,
      section: 'Package updates',
    };
  } catch {
    return {
      name: 'update_check',
      status: 'INFO',
      message: 'could not check for updates (offline or registry unreachable)',
      section: 'Package updates',
    };
  }
}

module.exports = { checkForUpdate, DEFAULT_REGISTRY_URL };
