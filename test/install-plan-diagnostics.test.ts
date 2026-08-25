import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { install } from '../src/install';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-install-plan-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

test('blocked install plan is diagnostic, non-mutating, and does not become applicable', () => {
  const homeDir = path.join(temporary, 'home');
  const cwd = path.join(temporary, 'project');
  const target = path.join(homeDir, '.agents', 'skills');
  fs.mkdirSync(path.join(target, 'sdd-agentic-flow-shared'), { recursive: true });
  fs.writeFileSync(
    path.join(target, 'sdd-agentic-flow-shared', 'install-provenance.yml'),
    [
      'package: sdd-agentic-flow',
      'package_version: 7.0.0',
      'schema: saf-install-provenance/v99',
      '',
    ].join('\n'),
    'utf8',
  );
  fs.mkdirSync(cwd, { recursive: true });
  process.exitCode = undefined;

  const result = install('full', cwd, {
    homeDir,
    scope: 'user',
    targets: ['agents'],
    plan: true,
    quiet: true,
  });

  assert.equal(result, false);
  assert.equal(process.exitCode, undefined);
  assert.equal(fs.existsSync(path.join(target, 'saf-route')), false);
});
