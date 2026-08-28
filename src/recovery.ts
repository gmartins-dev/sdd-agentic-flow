import type { InstallationKind } from './install-domain';
import type { SetupState } from './setup-state';

type RecoveryScope = 'project' | 'user' | 'combined';
type RemediationCode =
  | 'continue_setup'
  | 'reconcile_installation'
  | 'clean_reinstall'
  | 'upgrade_cli'
  | 'upgrade_skills'
  | 'initialize_workspace'
  | 'use_git_workspace'
  | 'resolve_collision'
  | 'resolve_source_control_visibility'
  | 'review_details';

type RecoveryAction = {
  code: RemediationCode;
  scope?: RecoveryScope;
  recommended: boolean;
  destructive: boolean;
  reason: string;
};

type RecoveryFacts = {
  setupState: SetupState;
  installationKind?: InstallationKind;
  installationDrift?: boolean;
  projectDrift?: boolean;
  sourceControlVisibilityDrift?: boolean;
  collision?: boolean;
  gitAvailable?: boolean;
};

type RecoveryPlan = {
  recommended: RecoveryAction | null;
  actions: RecoveryAction[];
};

function action(
  code: RemediationCode,
  reason: string,
  options: Partial<Pick<RecoveryAction, 'scope' | 'destructive'>> = {},
): RecoveryAction {
  return { code, reason, recommended: false, destructive: false, ...options };
}

function planRecovery(facts: RecoveryFacts): RecoveryPlan {
  const actions: RecoveryAction[] = [];
  if (facts.installationKind === 'future')
    actions.push(
      action('upgrade_cli', 'A newer SAF installation format was found.', {
        scope: 'user',
      }),
      action('clean_reinstall', 'Reset only SAF locations known to this CLI.', {
        scope: facts.projectDrift ? 'combined' : 'user',
        destructive: true,
      }),
    );
  else if (facts.installationKind === 'legacy' || facts.installationKind === 'unknown')
    actions.push(
      action('clean_reinstall', 'The SAF installation cannot be used safely.', {
        scope: facts.projectDrift ? 'combined' : 'user',
        destructive: true,
      }),
    );
  if (facts.collision)
    actions.push(
      action('resolve_collision', 'A foreign path conflicts with a managed target.', {
        scope: 'project',
      }),
    );
  if (facts.sourceControlVisibilityDrift)
    actions.push(
      action(
        'resolve_source_control_visibility',
        'Tracked files conflict with the requested local visibility.',
        { scope: 'project' },
      ),
    );
  if (facts.installationDrift)
    actions.push(
      action('reconcile_installation', 'The selected installation is out of sync.', {
        scope: facts.projectDrift ? 'combined' : 'user',
      }),
    );
  if (facts.setupState === 'Incomplete')
    actions.push(
      action('continue_setup', 'Setup is incomplete but can continue.', {
        scope: facts.gitAvailable === false ? 'user' : 'combined',
      }),
    );
  if (facts.gitAvailable === false)
    actions.push(
      action('use_git_workspace', 'Project setup requires a Git workspace.', {
        scope: 'project',
      }),
    );
  if (facts.setupState === 'Attention' && !actions.length)
    actions.push(action('review_details', 'Review the reported setup findings.'));

  const priority: RemediationCode[] = [
    'upgrade_cli',
    'clean_reinstall',
    'resolve_collision',
    'resolve_source_control_visibility',
    'reconcile_installation',
    'continue_setup',
    'initialize_workspace',
    'use_git_workspace',
    'upgrade_skills',
    'review_details',
  ];
  const recommendedCode = priority.find((code) => actions.some((item) => item.code === code));
  return {
    actions: actions.map((item) => ({ ...item, recommended: item.code === recommendedCode })),
    recommended: actions.find((item) => item.code === recommendedCode) || null,
  };
}

export type { RecoveryAction, RecoveryFacts, RecoveryPlan, RecoveryScope, RemediationCode };
export { planRecovery };
