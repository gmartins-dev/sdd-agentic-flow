'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { buildDoctorView, primaryRemediation } = require('../bin/doctor-view');

test('doctor view groups the missing-install symptoms behind one fix', () => {
  const checks = [
    { name: 'config', status: 'PASS', message: 'found' },
    { name: 'skills', status: 'WARN', message: 'core skills not fully installed' },
    { name: 'shared_layer', status: 'WARN', message: 'shared layer not installed' },
    {
      name: 'language_profile',
      status: 'WARN',
      message: 'language profile is configured but not installed',
    },
  ];
  assert.equal(primaryRemediation(checks), 'sdd-agentic-flow install core');
  const view = buildDoctorView(checks);
  assert.equal(view.title, 'Needs action');
  assert.equal(view.shown.length, 3);
});
