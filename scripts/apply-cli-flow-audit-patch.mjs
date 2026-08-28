import fs from 'node:fs';

const file = 'src/setup.ts';
let source = fs.readFileSync(file, 'utf8');

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`patch target not found: ${label}`);
  source = source.replace(from, to);
}

function replaceRegex(pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`patch target not found: ${label}`);
  source = source.replace(pattern, replacement);
}

replaceOnce("import { configureIntent } from './configure';\n", '', 'remove premature configureIntent import');
replaceOnce(
  "  outputMode,\n  renderStep,",
  "  outputMode,\n  renderKeyValue,\n  renderStep,",
  'renderKeyValue import',
);

replaceOnce(
`function policyReviewTitle(draft: SetupPolicyDraft, locale: string): string {
  if (draft.kind === 'custom' || !draft.presetName) {
    return t(locale, 'setup.policyCustom');
  }
  return policyDisplayTitle(draft);
}`,
`function policyReviewTitle(draft: SetupPolicyDraft, locale: string): string {
  if (draft.kind === 'custom' || !draft.presetName) return t(locale, 'setup.policyCustom');
  if (draft.presetName === 'supervised')
    return t(locale, 'setup.policySupervised').replace(/\\s+[—-]\\s+.*$/, '');
  if (draft.presetName === 'manual') return t(locale, 'setup.policyManual');
  if (draft.presetName === 'autonomous') return t(locale, 'setup.policyAutonomous');
  return policyDisplayTitle(draft);
}`,
  'localized policy review title',
);

replaceRegex(
/async function applySetup\([\s\S]*?\n}\n\ntype SetupIntentResult/,
`async function applySetup(
  cwd: string,
  draft: SetupDraft,
  options: SetupCommandOptions,
  locale: string,
  plan?: SetupPlan,
) {
  const { install } = requireCommandDeps();
  const homeDir = asString(options.homeDir, os.homedir());
  process.exitCode = undefined;
  if (plan && !setupPlanIsCurrent(cwd, plan, homeDir)) {
    log('WARN', 'setup changed after review; render a new plan before applying');
    return false;
  }
  if (!plan && draft.precondition && draft.precondition !== setupPrecondition(cwd, homeDir)) {
    log('WARN', 'setup changed after review; render a new plan before applying');
    return false;
  }
  if (draft.install && !plan && !(await preflightSetup(cwd, draft, options))) return false;
  if (plan && plan.installationPlan.applicability !== 'applicable') {
    log('WARN', plan.blockers.join('; ') || 'installation plan is not applicable', locale);
    return false;
  }
  process.stdout.write(\`\\n\${t(locale, 'setup.apply')}\\n\\n\`);
  const policy =
    draft.policy ?? resolvePolicyFromCommandOptions(options) ?? defaultOnboardingPolicy();
  if (draft.install) {
    process.stdout.write(\`\${t(locale, 'menu.running')}: \${t(locale, 'setup.skills')}\\n\`);
    if (
      !(await install(cwd, {
        ...(draft.scope ? { scope: draft.scope } : {}),
        ...(draft.targets ? { targets: draft.targets } : {}),
        ...(draft.adoptionMode ? { adoptionMode: draft.adoptionMode } : {}),
        ...(plan?.installationPlan ? { resolvedPlan: plan.installationPlan } : {}),
        overwriteDiffers: Boolean(plan?.installationPlan.totals.MANAGED_MODIFIED),
        homeDir,
        quiet: true,
        ascii: Boolean(options.ascii),
      }))
    )
      return false;
    process.stdout.write(
      \`\${symbol('success', resolveMode({ ascii: Boolean(options.ascii) }))} \${t(locale, 'setup.skills')}\\n\`,
    );
  }
  const initialized = init(cwd, {
    ...(options.language ? { profile: options.language } : {}),
    ...(options.featureProfile ? { featureProfile: options.featureProfile } : {}),
    executionMode: policy.executionMode,
    autonomyLevel: policy.autonomyLevel,
    ...(policy.presetName ? { presetName: policy.presetName } : {}),
    ...(plan?.workspacePlan ? { workspacePlan: plan.workspacePlan } : {}),
    ...(options.presetAlias ? { presetAlias: options.presetAlias } : {}),
    quiet: true,
    homeDir,
    scope: draft.scope,
    localGitExclude: Boolean(options.localGitExclude),
    ascii: Boolean(options.ascii),
  });
  if (!initialized) return false;
  await doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
  const finalState = inspectSetupState(cwd, homeDir);
  if (
    (finalState.state === 'Ready' || finalState.state === 'Attention') &&
    finalState.evidence.blockers.length === 0
  ) {
    process.exitCode = undefined;
    log('PASS', t(locale, 'setup.ready'), locale);
    process.stdout.write(
      \`\\n\${t(locale, 'setup.policyReady', {
        preset: policyReviewTitle(policy, locale),
      })}\\n\${t(locale, 'setup.policyChangeHint')}\\n\`,
    );
    return true;
  }
  return false;
}

type SetupIntentResult`,
  'applySetup intent-last and truthful completion',
);

replaceRegex(
/async function collectSetupIntent\([\s\S]*?\n}\n\nfunction printSetupPlan/,
`async function collectSetupIntent(
  cwd: string,
  locale: string,
  options: SetupCommandOptions,
  homeDir: string,
): Promise<SetupIntentResult> {
  const choose = async (
    label: string,
    values: Array<{ value: string; label: string; selected?: boolean; action?: boolean }>,
    multiple = false,
  ) =>
    select(label, values, {
      multiple,
      ascii: Boolean(options.ascii),
      cancelValues: ['q', '0'],
      locale,
    });
  const persisted = persistedSetupIntent(cwd, homeDir);
  const sharingDefault = persisted.sharing ?? 'personal';
  const sharing = await choose(t(locale, 'install.sharingPrompt'), [
    {
      value: 'personal',
      label: t(locale, 'install.adoptionPersonal'),
      selected: sharingDefault === 'personal',
    },
    {
      value: 'specs-shared',
      label: t(locale, 'install.adoptionSpecsShared'),
      selected: sharingDefault === 'specs-shared',
    },
    {
      value: 'team',
      label: t(locale, 'install.adoptionTeam'),
      selected: sharingDefault === 'team',
    },
  ]);
  if (sharing.cancelled || typeof sharing.value !== 'string') return { cancelled: true };

  const hints = detectSetupHosts({ cwd, homeDir });
  const hostLabels: Record<string, string> = {
    codex: 'Codex',
    cursor: 'Cursor',
    'claude-code': 'Claude Code',
    'vscode-copilot': 'GitHub Copilot',
  };
  const persistedHosts = new Set(persisted.selectedHosts ?? []);
  const hasPersistedHosts = persistedHosts.size > 0;
  let selectedHosts: SetupIntent['selectedHosts'] = [];
  for (;;) {
    const hosts = await choose(
      t(locale, 'install.agentsPrompt'),
      hints.map((hint) => ({
        value: hint.host,
        label: \`\${hostLabels[hint.host] || hint.host}\${
          hint.detected ? (locale === 'pt-BR' ? ' (detectado)' : ' (detected)') : ''
        }\`,
        selected: hasPersistedHosts ? persistedHosts.has(hint.host) : hint.detected,
      })),
      true,
    );
    if (hosts.cancelled) return { cancelled: true };
    selectedHosts = (Array.isArray(hosts.value) ? hosts.value : []).filter(
      (host): host is SetupIntent['selectedHosts'][number] =>
        ['codex', 'cursor', 'claude-code', 'vscode-copilot'].includes(host),
    );
    if (selectedHosts.length) break;
    log(
      'WARN',
      locale === 'pt-BR'
        ? 'Selecione pelo menos um agente de código.'
        : 'Select at least one coding-agent host.',
      locale,
    );
  }

  const workflowDefault = persisted.workflow ?? 'supervised';
  const workflow = await choose(t(locale, 'menu.workflow'), [
    {
      value: 'supervised',
      label: t(locale, 'setup.policySupervised'),
      selected: workflowDefault === 'supervised',
    },
    {
      value: 'manual',
      label: t(locale, 'setup.policyManual'),
      selected: workflowDefault === 'manual',
    },
    {
      value: 'autonomous',
      label: t(locale, 'setup.policyAutonomous'),
      selected: workflowDefault === 'autonomous',
    },
    {
      value: 'custom',
      label: t(locale, 'setup.policyCustom'),
      selected: workflowDefault === 'custom',
    },
  ]);
  if (workflow.cancelled || typeof workflow.value !== 'string') return { cancelled: true };
  let executionMode: SetupIntent['executionMode'] = persisted.executionMode;
  let autonomyLevel: SetupIntent['autonomyLevel'] = persisted.autonomyLevel;
  if (workflow.value === 'custom') {
    const mode = await choose(
      t(locale, 'setup.policyExecutionMode'),
      EXECUTION_MODES.map((value) => ({
        value,
        label: value,
        selected: value === (executionMode ?? 'apply'),
      })),
    );
    if (mode.cancelled || typeof mode.value !== 'string') return { cancelled: true };
    const selectedExecutionMode = mode.value;
    const autonomy = await choose(
      t(locale, 'setup.policyAutonomyLevel'),
      AUTONOMY_LEVELS.filter((value) => autonomyComboValid(selectedExecutionMode, value)).map(
        (value) => ({
          value,
          label: value,
          selected: value === (autonomyLevel ?? 'supervised'),
        }),
      ),
    );
    if (autonomy.cancelled || typeof autonomy.value !== 'string') return { cancelled: true };
    executionMode = selectedExecutionMode as SetupIntent['executionMode'];
    autonomyLevel = autonomy.value as SetupIntent['autonomyLevel'];
  }
  const language = options.language
    ? { value: options.language }
    : persisted.language
      ? { value: persisted.language }
      : await choose(t(locale, 'menu.language'), [
          { value: 'en-US', label: 'English', selected: locale !== 'pt-BR' },
          { value: 'pt-BR', label: 'Português (Brasil)', selected: locale === 'pt-BR' },
        ]);
  if (('cancelled' in language && language.cancelled) || typeof language.value !== 'string')
    return { cancelled: true };
  return {
    sharing: sharing.value as SetupIntent['sharing'],
    selectedHosts,
    workflow: workflow.value as SetupIntent['workflow'],
    ...(executionMode ? { executionMode } : {}),
    ...(autonomyLevel ? { autonomyLevel } : {}),
    language: language.value as SetupIntent['language'],
  };
}

function printSetupPlan`,
  'collectSetupIntent always-review localized decisions',
);

replaceRegex(
/function printSetupPlan\([\s\S]*?\n}\n\nasync function preflightSetup/,
`function printSetupPlan(plan: SetupPlan, locale = 'en-US'): void {
  const sharing = plan.intent?.sharing;
  const sharingLabel =
    sharing === 'personal'
      ? t(locale, 'install.adoptionPersonal')
      : sharing === 'team'
        ? t(locale, 'install.adoptionTeam')
        : t(locale, 'install.adoptionSpecsShared');
  const targetLabels = plan.targets.map((target) =>
    target === 'agents'
      ? t(locale, 'install.targetShared')
      : target === 'claude'
        ? t(locale, 'install.targetClaude')
        : target === 'copilot'
          ? t(locale, 'install.targetCopilot')
          : target === 'cursor'
            ? 'Cursor'
            : target,
  );
  const workflow = plan.intent?.workflow
    ? plan.intent.workflow === 'supervised'
      ? t(locale, 'setup.policySupervised').replace(/\\s+[—-]\\s+.*$/, '')
      : plan.intent.workflow === 'manual'
        ? t(locale, 'setup.policyManual')
        : plan.intent.workflow === 'autonomous'
          ? t(locale, 'setup.policyAutonomous')
          : t(locale, 'setup.policyCustom')
    : '-';
  const language = plan.intent?.language === 'pt-BR' ? 'Português (Brasil)' : 'English';
  const mode = resolveMode();
  process.stdout.write(\`\\n\${t(locale, 'setup.review')}\\n\\n\`);
  const rows = [
    [locale === 'pt-BR' ? 'Compartilhamento' : 'Sharing', sharingLabel],
    [locale === 'pt-BR' ? 'Agentes' : 'Coding agents', targetLabels.join(', ') || '(none)'],
    [t(locale, 'menu.workflow'), workflow],
    [t(locale, 'menu.language'), language],
    [locale === 'pt-BR' ? 'Escopo' : 'Scope', plan.scope === 'project' ? t(locale, 'setup.project') : locale === 'pt-BR' ? 'Usuário' : 'User'],
  ] as const;
  for (const [key, value] of rows)
    process.stdout.write(\`  \${renderKeyValue(key, value, mode).join('\\n  ')}\\n\`);

  process.stdout.write(\`\\n\${locale === 'pt-BR' ? 'Alterações' : 'Changes'}\\n\`);
  const orderedActions = [
    ...plan.cleanupActions,
    ...plan.targetReconciliation,
    ...plan.adoptionChanges,
    ...plan.installationIntent,
    ...plan.configMutation,
    ...plan.workspaceInitialization,
  ];
  for (const item of orderedActions) {
    const detail =
      locale !== 'pt-BR'
        ? item.detail
        : item.kind === 'cleanup-legacy'
          ? 'remover somente estado legado reconhecido e pertencente ao SAF'
          : item.kind === 'reconcile-target'
            ? 'instalar ou atualizar o bundle oficial de skills'
            : item.kind === 'adoption'
              ? 'sincronizar a visibilidade Git gerenciada para o compartilhamento escolhido'
              : item.kind === 'persist-intent'
                ? 'persistir a intenção final de instalação após a reconciliação bem-sucedida'
                : item.kind === 'config'
                  ? 'persistir somente valores gerenciados não padrão selecionados'
                  : item.kind === 'workspace'
                    ? 'inicializar o workspace e o contexto gerado'
                    : item.detail;
    process.stdout.write(\`  - \${detail}\\n\`);
  }
  for (const warning of plan.warnings)
    process.stdout.write(\`  \${locale === 'pt-BR' ? 'Aviso' : 'Warning'}: \${translateText(locale, warning)}\\n\`);
  for (const blocker of plan.blockers)
    process.stdout.write(\`  \${locale === 'pt-BR' ? 'Bloqueado' : 'Blocked'}: \${translateText(locale, blocker)}\\n\`);
}

async function preflightSetup`,
  'localized adaptive setup review',
);

replaceOnce(
`function needsSessionLanguageSelection(state: string, hasReliableLocale: boolean): boolean {
  return state === 'Fresh' && !hasReliableLocale;
}`,
`function needsSessionLanguageSelection(state: string, hasReliableLocale: boolean): boolean {
  return !hasReliableLocale && ['Fresh', 'Incomplete', 'Blocked'].includes(state);
}`,
  'session locale for incomplete recovery',
);

replaceRegex(
/function renderOperationResult\([\s\S]*?\n}\n\nasync function chooseSessionLocale/,
`function renderOperationResult(
  title: string,
  state: OperationResultState,
  summary: string,
  locale = 'en-US',
): string {
  const labels =
    locale === 'pt-BR'
      ? {
          success: 'Concluído',
          error: 'Erro',
          cancelled: 'Cancelado',
          details: 'Detalhes',
          recovery: 'Recuperação',
          next: 'Próxima ação',
        }
      : {
          success: 'Success',
          error: 'Error',
          cancelled: 'Cancelled',
          details: 'Details',
          recovery: 'Recovery',
          next: 'Next action',
        };
  const recovery =
    state === 'success'
      ? locale === 'pt-BR'
        ? 'o estado aplicado pode ser revisado no menu Validar'
        : 'review the applied state from the Validate menu'
      : state === 'cancelled'
        ? locale === 'pt-BR'
          ? 'nenhuma nova ação será iniciada até você escolher continuar'
          : 'no new action will start until you choose to continue'
        : locale === 'pt-BR'
          ? 'revise o estado atual antes de tentar novamente; alguma alteração durável pode ter sido aplicada'
          : 'review the current state before retrying; some durable state may have been applied';
  return \`\\n\${title}\\n\\n\${labels[state]}: \${summary}\\n\${labels.details}: \${summary}\\n\${labels.recovery}: \${recovery}\\n\\n\${labels.next}: \${
    state === 'success'
      ? locale === 'pt-BR'
        ? 'retorne ao menu ou revise o estado atual'
        : 'return to the menu or review the current state'
      : locale === 'pt-BR'
        ? 'retorne ao menu para revisar antes de tentar novamente'
        : 'return to the menu and review before retrying'
  }\\n\`;
}

async function chooseSessionLocale`,
  'truthful operation result recovery',
);

replaceOnce(
`    return next.cancelled || next.value === 'exit';`,
`    if (next.cancelled) return next.cancelReason === 'interrupt';
    return next.value === 'exit';`,
  'result page Esc returns instead of exits',
);

replaceOnce(
`      if (choice.cancelled || choice.value === 'exit') return 'exit';
      if (choice.value === 'back') return 'back';`,
`      if (choice.cancelled)
        return choice.cancelReason === 'escape' ? 'back' : 'exit';
      if (choice.value === 'exit') return 'exit';
      if (choice.value === 'back') return 'back';`,
  'settings Esc navigation',
);
replaceOnce(
`        if (workflow.cancelled || workflow.value === 'exit') return 'exit';`,
`        if (workflow.cancelled) {
          if (workflow.cancelReason === 'interrupt') return 'exit';
          continue;
        }
        if (workflow.value === 'exit') return 'exit';`,
  'workflow Esc navigation',
);
replaceOnce(
`        if (language.cancelled || language.value === 'exit') return 'exit';`,
`        if (language.cancelled) {
          if (language.cancelReason === 'interrupt') return 'exit';
          continue;
        }
        if (language.value === 'exit') return 'exit';`,
  'language Esc navigation',
);

replaceOnce(
`      if (choice.cancelled || choice.value === 'exit') return 'exit';
      if (choice.value === 'back') return 'back';
      const commands: Record<string, [string, string[]]> = {`,
`      if (choice.cancelled)
        return choice.cancelReason === 'escape' ? 'back' : 'exit';
      if (choice.value === 'exit') return 'exit';
      if (choice.value === 'back') return 'back';
      const commands: Record<string, [string, string[]]> = {`,
  'advanced Esc navigation',
);

replaceOnce(
`      if (action.cancelled || action.value === 'exit') {
        if (action.cancelled) process.stdout.write(\`\${t(locale, 'welcome.cancelled')}\\n\`);
        return;
      }`,
`      if (action.cancelled) {
        if (action.cancelReason === 'interrupt') return;
        continue;
      }
      if (action.value === 'exit') return;`,
  'ready root Esc redraw',
);

replaceOnce(
`      if (action.cancelled || action.value === 'exit') return;
      initialScreen = false;`,
`      if (action.cancelled) {
        if (action.cancelReason === 'interrupt') return;
        continue;
      }
      if (action.value === 'exit') return;
      initialScreen = false;`,
  'blocked root Esc redraw',
);

replaceOnce(
`    if (entry.cancelled || entry.value === 'exit') {
      if (entry.cancelled) process.stdout.write(\`\${t(locale, 'welcome.cancelled')}\\n\`);
      return;
    }`,
`    if (entry.cancelled) {
      if (entry.cancelReason === 'interrupt') return;
      continue;
    }
    if (entry.value === 'exit') return;`,
  'fresh root Esc redraw',
);

replaceRegex(
/    printSetupPlan\(plan, locale\);[\s\S]*?    const policy =/,
`    printSetupPlan(plan, locale);
    if (plan.blocked) {
      const blockedChoice = await select(
        locale === 'pt-BR'
          ? 'Esta configuração ainda não pode ser aplicada.'
          : 'This setup cannot be applied yet.',
        [
          { value: 'change', label: t(locale, 'setup.changeChoices'), action: true },
          { value: 'validate', label: t(locale, 'menu.validate'), action: true },
          { value: 'exit', label: t(locale, 'setup.exit'), action: true },
        ],
        { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
      );
      if (blockedChoice.cancelled) {
        if (blockedChoice.cancelReason === 'interrupt') return;
        continue;
      }
      if (blockedChoice.value === 'exit') return;
      if (blockedChoice.value === 'validate')
        await doctor(cwd, { ascii: Boolean(options.ascii), homeDir });
      continue;
    }
    const review = await select(
      locale === 'pt-BR' ? 'Aplicar esta configuração?' : 'Apply this setup?',
      [
        {
          value: 'apply',
          label: locale === 'pt-BR' ? 'Instalar e configurar' : 'Install and configure',
        },
        { value: 'back', label: t(locale, 'setup.back'), action: true },
        { value: 'cancel', label: t(locale, 'setup.cancel'), action: true },
      ],
      { ascii: Boolean(options.ascii), cancelValues: ['q', '0'], locale },
    );
    if (review.cancelled || review.value === 'cancel')
      return log('INFO', t(locale, 'setup.cancelled'), locale);
    if (review.value === 'back') continue;
    if (review.value !== 'apply') continue;
    if (!setupPlanIsCurrent(cwd, plan, homeDir)) {
      log('WARN', 'setup changed after review; a new plan and confirmation are required', locale);
      continue;
    }
    const policy =`,
  'review apply boundary and blocked recovery',
);

replaceOnce(
`    if (await applySetup(cwd, draft, applyOptions, locale, plan)) return;
    process.stdout.write(\`\\n\${t(locale, 'setup.failed')}\\n\`);`,
`    if (await applySetup(cwd, draft, applyOptions, locale, plan)) return;
    const failedState = inspectSetupState(cwd, homeDir);
    process.stdout.write(
      \`\\n\${t(locale, 'setup.failed')}\\n\` +
        \`\${locale === 'pt-BR' ? 'Estado observado' : 'Observed state'}: \${failedState.state}\\n\`,
    );`,
  'failed setup observed state',
);
replaceOnce(
`    if (recovery.cancelled || recovery.value === 'exit') return;
    if (recovery.value === 'validate')`,
`    if (recovery.cancelled) {
      if (recovery.cancelReason === 'interrupt') return;
      continue;
    }
    if (recovery.value === 'exit') return;
    if (recovery.value === 'validate')`,
  'recovery Esc navigation',
);

fs.writeFileSync(file, source, 'utf8');
console.log('PASS deterministic setup.ts CLI-flow audit patch applied');
