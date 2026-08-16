// State is deliberately derived from durable setup artifacts.  There is no
// onboarding marker to get stale or to make a repaired installation look new.

type DoctorStatus = 'PASS' | 'WARN' | 'FAIL' | null;
type OnboardingState = 'NEW_PROJECT' | 'FIRST_USE' | 'PARTIAL' | 'NEEDS_ATTENTION' | 'READY';

type OnboardingInput = {
  hasConfig?: boolean;
  hasSkills?: boolean;
  hasContext?: boolean;
  doctorStatus?: DoctorStatus;
};

function resolveOnboardingState({
  hasConfig,
  hasSkills,
  hasContext,
  doctorStatus = null,
}: OnboardingInput = {}): OnboardingState {
  if (!hasConfig && hasSkills) return 'NEW_PROJECT';
  if (!hasConfig && !hasSkills) return 'FIRST_USE';
  if (!hasSkills || !hasContext) return 'PARTIAL';
  if (doctorStatus === 'FAIL' || doctorStatus === 'WARN') return 'NEEDS_ATTENTION';
  if (doctorStatus === 'PASS') return 'READY';
  return 'PARTIAL';
}

export type { DoctorStatus, OnboardingInput, OnboardingState };
export { resolveOnboardingState };
