import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { inspectCleanUpgrade, prepareCleanUpgrade } from '../src/clean-upgrade';

function write(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

test('clean upgrade recognizes v1 ownership and can rollback managed assets only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-clean-upgrade-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  const target = path.join(home, '.agents', 'skills');
  write(path.join(home, '.sdd-agentic-flow', 'install.yml'), 'schema: saf-install-intent/v1\n');
  write(
    path.join(target, 'sdd-agentic-flow-shared', 'install-provenance.yml'),
    [
      'package: sdd-agentic-flow',
      'package_version: 5.0.0',
      'schema: saf-install-provenance/v1',
      'managed_skills:',
      '  - saf-route',
      '',
    ].join('\n'),
  );
  write(path.join(target, 'saf-route', 'SKILL.md'), 'legacy');
  write(path.join(cwd, '.sdd-agentic-flow', 'config.yml'), 'schema: saf-config/v1\n');
  write(path.join(cwd, '.sdd-agentic-flow', 'autonomy', 'loop-state.md'), 'old loop');
  write(path.join(cwd, '.sdd-agentic-flow', 'autonomy', 'operator-note.md'), 'keep');
  write(path.join(cwd, '.specs', 'features', 'keep', 'spec.md'), 'keep');

  const inspection = inspectCleanUpgrade({ cwd, homeDir: home, targetRoots: [target] });
  assert.equal(inspection.state, 'legacy');
  const session = prepareCleanUpgrade(inspection);
  assert.equal(fs.existsSync(path.join(target, 'saf-route')), false);
  assert.equal(fs.existsSync(path.join(cwd, '.sdd-agentic-flow', 'config.yml')), false);
  assert.equal(
    fs.readFileSync(path.join(cwd, '.sdd-agentic-flow', 'autonomy', 'operator-note.md'), 'utf8'),
    'keep',
  );
  assert.equal(fs.existsSync(path.join(cwd, '.specs', 'features', 'keep', 'spec.md')), true);
  session.rollback();
  assert.equal(fs.readFileSync(path.join(target, 'saf-route', 'SKILL.md'), 'utf8'), 'legacy');
  assert.equal(
    fs.readFileSync(path.join(cwd, '.sdd-agentic-flow', 'config.yml'), 'utf8'),
    'schema: saf-config/v1\n',
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('future or untrusted state fails closed before cleanup', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-clean-upgrade-'));
  const home = path.join(root, 'home');
  const cwd = path.join(root, 'project');
  const target = path.join(home, '.agents', 'skills');
  write(path.join(home, '.sdd-agentic-flow', 'install.yml'), 'schema: saf-install-intent/v3\n');
  write(path.join(target, 'saf-route', 'SKILL.md'), 'untouched');
  const future = inspectCleanUpgrade({ cwd, homeDir: home, targetRoots: [target] });
  assert.equal(future.state, 'future');
  assert.equal(fs.readFileSync(path.join(target, 'saf-route', 'SKILL.md'), 'utf8'), 'untouched');
  fs.rmSync(root, { recursive: true, force: true });
});
