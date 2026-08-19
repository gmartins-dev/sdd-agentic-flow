import type { DoctorCheck } from './doctor-view';

const HARNESS_CHECKS = new Set([
  'package_integrity',
  'config',
  'legacy_sdd_root',
  'installation_intent',
  'legacy_installation',
  'skills',
  'shared_layer',
  'project_readiness',
  'project_context',
  'tdd-baseline',
  'artifact-contracts',
  'evidence-first',
  'safety',
  'agent_compatibility',
  'project_instructions',
  'specs_root',
  'ci_present',
]);

function harnessReadinessChecks(checks: DoctorCheck[]): DoctorCheck[] {
  return checks.filter((check) => HARNESS_CHECKS.has(check.name));
}

export { harnessReadinessChecks };
