import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { install } from '../src/install';
import { preflightSetup, setSetupCommandDeps } from '../src/setup';

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
    install: (pack, root, options) => install(pack, root, { ...options, homeDir }),
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
      pack: 'full',
      targets: ['agents'],
    },
    { quiet: true, homeDir },
  );

  assert.equal(result, false);
  assert.equal(fs.existsSync(path.join(cwd, '.sdd-agentic-flow', 'config.yml')), false);
  assert.equal(fs.existsSync(path.join(cwd, '.sdd-agentic-flow', 'context')), false);
});
