import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  detectSetupHosts,
  resolveSetupPlan,
  setupPlanIsCurrent,
  setupPrecondition,
  targetsForHosts,
} from '../src/setup-plan';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

test('maps selected hosts to deduplicated persisted targets', () => {
  assert.deepEqual(targetsForHosts(['codex', 'cursor', 'claude-code']), [
    'agents',
    'cursor',
    'claude',
  ]);
});

test('invalidates a reviewed setup plan when durable inputs change', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-'));
  try {
    const plan = { precondition: setupPrecondition(cwd) } as Parameters<
      typeof setupPlanIsCurrent
    >[1];
    fs.mkdirSync(path.join(cwd, '.sdd-agentic-flow'), { recursive: true });
    fs.writeFileSync(path.join(cwd, '.sdd-agentic-flow', 'workspace.yml'), 'changed\n');
    assert.equal(setupPlanIsCurrent(cwd, plan), false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('detects hosts from injected local hints without executing providers', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-host-cwd-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-host-home-'));
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-host-bin-'));
  try {
    fs.mkdirSync(path.join(home, '.cursor'), { recursive: true });
    fs.writeFileSync(path.join(bin, process.platform === 'win32' ? 'claude.cmd' : 'claude'), '', {
      mode: 0o755,
    });
    const detected = detectSetupHosts({ cwd, homeDir: home, env: { PATH: bin } });
    assert.equal(detected.find((host) => host.host === 'cursor')?.detected, true);
    assert.equal(detected.find((host) => host.host === 'claude-code')?.detected, true);
    assert.equal(detected.find((host) => host.host === 'codex')?.detected, false);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(bin, { recursive: true, force: true });
  }
});

test('resolves an inspectable plan with no executable callbacks', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-shape-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-home-'));
  try {
    const snapshot = {
      config: 'absent',
      workspace: 'absent',
      skills: 'absent',
      context: false,
      homeDir: home,
      evidence: { warnings: [], blockers: [], targetSet: [], targetEvidence: [] },
      state: 'Fresh',
    } as unknown as Parameters<typeof resolveSetupPlan>[1];
    const plan = resolveSetupPlan(
      cwd,
      snapshot,
      {
        sharing: 'personal',
        selectedHosts: ['codex', 'cursor'],
        workflow: 'supervised',
        language: 'en-US',
      },
      home,
    );
    assert.equal(plan.blocked, false);
    assert.deepEqual(plan.targets, ['agents', 'cursor']);
    assert.equal(plan.preconditions.inputs.includes('unrelated home data'), false);
    assert.equal(
      Object.values(plan).some((value) => typeof value === 'function'),
      false,
    );
    assert.equal(setupPlanIsCurrent(cwd, plan, home), true);
    assert.match(plan.installationIntent[0]?.detail ?? '', /after successful reconciliation/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('setup review is blocked when the authoritative installation plan has a collision', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-collision-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'saf-setup-plan-collision-home-'));
  try {
    const conflictingSkill = path.join(home, '.agents', 'skills', OFFICIAL_SKILLS[0]);
    fs.mkdirSync(conflictingSkill, { recursive: true });
    fs.writeFileSync(path.join(conflictingSkill, 'SKILL.md'), '# foreign\n', 'utf8');
    const snapshot = {
      config: 'absent',
      workspace: 'absent',
      skills: 'partial',
      context: false,
      homeDir: home,
      evidence: { warnings: [], blockers: [], targetSet: [], targetEvidence: [] },
      state: 'Incomplete',
    } as unknown as Parameters<typeof resolveSetupPlan>[1];
    const plan = resolveSetupPlan(
      cwd,
      snapshot,
      {
        sharing: 'personal',
        selectedHosts: ['codex'],
        workflow: 'supervised',
        language: 'en-US',
      },
      home,
    );
    assert.equal(plan.installationPlan.blocked, true);
    assert.equal(plan.blocked, true);
    assert.match(plan.blockers.join('\n'), /unowned skill directories conflict with SAF/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
    fs.rmSync(home, { recursive: true, force: true });
  }
});
