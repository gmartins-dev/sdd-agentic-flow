import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { install } from '../src/install';
import { applySetup, preflightSetup, setSetupCommandDeps } from '../src/setup';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-setup-preflight-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('blocked guided setup preflight produces no project writes', async () => {
  const homeDir = path.join(temporary, 'home');
  const cwd = path.join(temporary, 'project');
  const target = path.join(homeDir, '.agents', 'skills', 'sdd-agentic-flow-shared');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(
    path.join(target, 'install-provenance.yml'),
    'package: sdd-agentic-flow\nschema: saf-install-provenance/v99\n',
    'utf8',
  );
  fs.mkdirSync(cwd, { recursive: true });
  setSetupCommandDeps({
    install: (root, options) => install(root, { ...options, homeDir }),
    upgradeCommand: async () => undefined,
    runCommand: async () => undefined,
    runInteractiveMenu: async () => undefined,
    changeInstallation: async () => undefined,
  });

  const result = await preflightSetup(
    cwd,
    {
      install: true,
      scope: 'user',
      targets: ['agents'],
    },
    { quiet: true, homeDir },
  );

  assert.equal(result, false);
  assert.equal(fs.existsSync(path.join(cwd, '.sdd-agentic-flow', 'config.yml')), false);
  assert.equal(fs.existsSync(path.join(cwd, '.sdd-agentic-flow', 'context')), false);
});

test('Apply failures retain the reviewed session locale', async () => {
  const homeDir = path.join(temporary, 'apply-failure-home');
  const cwd = path.join(temporary, 'apply-failure-project');
  const calls: Array<Record<string, unknown>> = [];
  fs.mkdirSync(cwd, { recursive: true });
  setSetupCommandDeps({
    install: (_root, options) => {
      calls.push(options);
      return Boolean(options.plan);
    },
    upgradeCommand: async () => undefined,
    runCommand: async () => undefined,
    runInteractiveMenu: async () => undefined,
    changeInstallation: async () => undefined,
  });

  const result = await applySetup(
    cwd,
    { install: true, scope: 'user', targets: ['agents'] },
    { quiet: true, ascii: true, homeDir },
    'pt-BR',
  );

  assert.equal(result, false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.locale, 'pt-BR');
  assert.equal(fs.existsSync(path.join(cwd, '.sdd-agentic-flow', 'config.yml')), false);
});
