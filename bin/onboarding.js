'use strict';

// State is deliberately derived from durable setup artifacts.  There is no
// onboarding marker to get stale or to make a repaired installation look new.
function resolveOnboardingState({ hasConfig, hasSkills, hasContext, doctorStatus = null } = {}) {
  if (!hasConfig && hasSkills) return 'NEW_PROJECT';
  if (!hasConfig && !hasSkills) return 'FIRST_USE';
  if (!hasSkills || !hasContext) return 'PARTIAL';
  if (doctorStatus === 'FAIL' || doctorStatus === 'WARN') return 'NEEDS_ATTENTION';
  if (doctorStatus === 'PASS') return 'READY';
  return 'PARTIAL';
}

module.exports = { resolveOnboardingState };
