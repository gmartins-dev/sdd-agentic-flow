'use strict';

const { t } = require('./messages');

function summarizeChecks(checks = []) {
  const counts = { PASS: 0, INFO: 0, WARN: 0, FAIL: 0 };
  for (const check of checks) counts[check.status] = (counts[check.status] || 0) + 1;
  return counts;
}

function primaryRemediation(checks = []) {
  const byName = new Map(checks.map((check) => [check.name, check]));
  if (['WARN', 'FAIL'].includes(byName.get('config')?.status)) return 'sdd-agentic-flow init';
  if (['WARN', 'FAIL'].includes(byName.get('skills')?.status))
    return 'sdd-agentic-flow install core';
  if (['WARN', 'FAIL'].includes(byName.get('installation_intent')?.status))
    return 'sdd-agentic-flow install core';
  if (['WARN', 'FAIL'].includes(byName.get('language_profile')?.status)) {
    const language = byName.get('language_profile');
    return /not installed/i.test(language.message)
      ? 'sdd-agentic-flow install core'
      : 'sdd-agentic-flow init --language <profile>';
  }
  return null;
}

function buildDoctorView(checks, { verbose = false, locale = 'en-US' } = {}) {
  const counts = summarizeChecks(checks);
  const hasProblems = counts.WARN + counts.FAIL > 0;
  const shown = verbose
    ? checks
    : checks.filter((check) => ['WARN', 'FAIL'].includes(check.status));
  return {
    counts,
    hasProblems,
    title: hasProblems ? t(locale, 'doctor.needsAction') : t(locale, 'ready.title'),
    primaryFix: primaryRemediation(checks),
    shown,
  };
}

module.exports = { summarizeChecks, primaryRemediation, buildDoctorView };
