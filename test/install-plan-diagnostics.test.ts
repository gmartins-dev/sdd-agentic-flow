import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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

  const result = install(cwd, {
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

test('user target removal cleans only SAF-owned content', () => {
  const homeDir = path.join(temporary, 'switch-home');
  const cwd = path.join(temporary, 'switch-project');
  fs.mkdirSync(cwd, { recursive: true });
  process.exitCode = undefined;

  assert.equal(install(cwd, { homeDir, scope: 'user', targets: ['agents'], quiet: true }), true);
  const agentsRoot = path.join(homeDir, '.agents', 'skills');
  const foreign = path.join(agentsRoot, 'notes.txt');
  fs.writeFileSync(foreign, 'keep me\n', 'utf8');

  assert.equal(install(cwd, { homeDir, scope: 'user', targets: ['claude'], quiet: true }), true);
  assert.equal(fs.existsSync(path.join(agentsRoot, 'saf-route')), false);
  assert.equal(fs.existsSync(foreign), true);
  assert.equal(
    fs.existsSync(path.join(agentsRoot, 'sdd-agentic-flow-shared', 'install-provenance.yml')),
    false,
  );
});

test('team transitions preserve user roots and remove only the owned project root', () => {
  const homeDir = path.join(temporary, 'transition-home');
  const cwd = path.join(temporary, 'transition-project');
  fs.mkdirSync(cwd, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd });
  process.exitCode = undefined;

  assert.equal(
    install(cwd, {
      homeDir,
      scope: 'user',
      targets: ['agents'],
      adoptionMode: 'personal',
      quiet: true,
    }),
    true,
  );
  const userSkill = path.join(homeDir, '.agents', 'skills', 'saf-route');
  assert.equal(fs.existsSync(userSkill), true);

  assert.equal(
    install(cwd, { homeDir, scope: 'project', adoptionMode: 'team', quiet: true }),
    true,
  );
  const projectRoot = path.join(cwd, '.agents', 'skills');
  assert.equal(fs.existsSync(path.join(projectRoot, 'saf-route')), true);
  assert.equal(fs.existsSync(userSkill), true);

  assert.equal(
    install(cwd, {
      homeDir,
      scope: 'user',
      targets: ['agents'],
      adoptionMode: 'personal',
      quiet: true,
    }),
    true,
  );
  assert.equal(fs.existsSync(path.join(projectRoot, 'saf-route')), false);
  assert.equal(fs.existsSync(userSkill), true);
});
