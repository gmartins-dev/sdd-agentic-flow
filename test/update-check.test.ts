import assert from 'node:assert/strict';
import { test } from 'node:test';

import { checkForUpdate } from '../src/update-check';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

test('checkForUpdate reports PASS when already up to date', async () => {
  let calls = 0;
  const result = await checkForUpdate({
    currentVersion: '1.4.0',
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ version: '1.4.0' });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.name, 'update_check');
  assert.equal(result.status, 'PASS');
  assert.match(result.message, /up to date/);
});

test('checkForUpdate reports WARN with both versions and points at upgrade when outdated', async () => {
  const result = await checkForUpdate({
    currentVersion: '1.4.0',
    fetchImpl: async () => jsonResponse({ version: '1.9.0' }),
  });
  assert.equal(result.status, 'WARN');
  assert.equal(result.updateAvailable, true);
  assert.equal(result.latest, '1.9.0');
  assert.equal(result.reachable, true);
  assert.match(result.message, /1\.4\.0/);
  assert.match(result.message, /1\.9\.0/);
  assert.match(result.message, /sdd-agentic-flow upgrade/);
});

test('checkForUpdate degrades to INFO when the fetch rejects (offline)', async () => {
  const result = await checkForUpdate({
    currentVersion: '1.4.0',
    fetchImpl: async () => {
      throw new Error('getaddrinfo ENOTFOUND registry.npmjs.org');
    },
  });
  assert.equal(result.status, 'INFO');
  assert.match(result.message, /could not check for updates/);
});

test('checkForUpdate degrades to INFO on a non-2xx response', async () => {
  const result = await checkForUpdate({
    currentVersion: '1.4.0',
    fetchImpl: async () => jsonResponse({}, false, 404),
  });
  assert.equal(result.status, 'INFO');
});

test('checkForUpdate degrades to INFO on a malformed body (missing version field)', async () => {
  const result = await checkForUpdate({
    currentVersion: '1.4.0',
    fetchImpl: async () => jsonResponse({ notVersion: 'oops' }),
  });
  assert.equal(result.status, 'INFO');
});

test('checkForUpdate degrades to INFO on an unparseable version string', async () => {
  const result = await checkForUpdate({
    currentVersion: '1.4.0',
    fetchImpl: async () => jsonResponse({ version: 'not-a-version' }),
  });
  assert.equal(result.status, 'INFO');
});

test('checkForUpdate never hangs: a fetchImpl that never resolves still returns within a short bound', async () => {
  const start = Date.now();
  const result = await checkForUpdate({
    currentVersion: '1.4.0',
    timeoutMs: 50,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  });
  assert.equal(result.status, 'INFO');
  assert.ok(Date.now() - start < 1000, 'expected the timeout to bound the wait well under 1s');
});

test('checkForUpdate never invokes the real global fetch during tests', async () => {
  let realFetchCalled = false;
  const originalFetch = global.fetch;
  global.fetch = async (...args) => {
    realFetchCalled = true;
    return originalFetch(...args);
  };
  try {
    await checkForUpdate({
      currentVersion: '1.4.0',
      fetchImpl: async () => jsonResponse({ version: '1.4.0' }),
    });
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(realFetchCalled, false);
});
