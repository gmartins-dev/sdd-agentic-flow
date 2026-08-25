import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { officialSkillsPresence, officialSkillsPresenceForTargets } from '../src/doctor';
import {
  classifyInstallationState,
  classifyProvenanceVersion,
  schemaGenerationFor,
} from '../src/install-domain';
import { OFFICIAL_SKILLS } from '../src/skill-identity';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-installation-truth-'));
after(() => fs.rmSync(temporary, { recursive: true, force: true }));

function skill(root: string, name: string): void {
  fs.mkdirSync(path.join(root, name), { recursive: true });
  fs.writeFileSync(path.join(root, name, 'SKILL.md'), '# skill\n', 'utf8');
}

test('official skill presence distinguishes empty, partial, and complete roots', () => {
  const empty = path.join(temporary, 'empty');
  const partial = path.join(temporary, 'partial');
  const complete = path.join(temporary, 'complete');
  fs.mkdirSync(empty, { recursive: true });
  fs.mkdirSync(partial, { recursive: true });
  fs.mkdirSync(complete, { recursive: true });
  skill(partial, OFFICIAL_SKILLS[0]);
  for (const name of OFFICIAL_SKILLS) skill(complete, name);

  assert.equal(officialSkillsPresence(empty).empty, true);
  assert.equal(officialSkillsPresence(empty).complete, false);
  assert.equal(officialSkillsPresence(partial).partial, true);
  assert.equal(officialSkillsPresence(partial).missing.length, OFFICIAL_SKILLS.length - 1);
  assert.equal(officialSkillsPresence(complete).complete, true);
  assert.equal(officialSkillsPresence(complete).missing.length, 0);
});

test('target presence keeps each target observable instead of collapsing roots', () => {
  const first = path.join(temporary, 'target-a');
  const second = path.join(temporary, 'target-b');
  fs.mkdirSync(first, { recursive: true });
  fs.mkdirSync(second, { recursive: true });
  skill(first, OFFICIAL_SKILLS[0]);
  for (const name of OFFICIAL_SKILLS) skill(second, name);
  const report = officialSkillsPresenceForTargets([first, second, first]);
  assert.deepEqual(
    report.map((target) => target.root),
    [first, second],
  );
  assert.equal(report[0]?.partial, true);
  assert.equal(report[1]?.complete, true);
});

test('installation dimensions remain independent and provenance direction is explicit', () => {
  assert.deepEqual(
    classifyInstallationState({
      intentKind: 'current',
      targetKinds: ['current'],
      reconciliationState: 'blocked_unknown_ownership',
      failureClass: 'none',
    }),
    {
      installationKind: 'current',
      reconciliationState: 'blocked_unknown_ownership',
      failureClass: 'none',
    },
  );
  assert.equal(
    classifyInstallationState({
      intentKind: 'future',
      reconciliationState: 'in_sync',
      failureClass: 'retryable',
    }).installationKind,
    'future',
  );
  assert.equal(classifyProvenanceVersion('3.4.0', '6.4.3'), 'older');
  assert.equal(classifyProvenanceVersion('6.4.3', '6.4.3'), 'current');
  assert.equal(classifyProvenanceVersion('7.0.0', '6.4.3'), 'newer');
  assert.equal(classifyProvenanceVersion('not-a-version', '6.4.3'), 'unknown');
  assert.equal(schemaGenerationFor('saf-install-intent/v2', 'saf-install-intent'), 2);
  assert.equal(schemaGenerationFor('saf-install-intent/malformed', 'saf-install-intent'), null);
});
