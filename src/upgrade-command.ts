import path from 'node:path';

import { renderCliCommand } from './cli-command';
import { errorMessage, fail, logStatus, resolveMode } from './cli-output';
import {
  hasOfficialSkillsAt,
  installationStatus,
  projectLocale,
  resolveConfiguredAgent,
  resolveSkillsRoot,
} from './doctor';
import { shouldShowInteractiveMenu } from './menu';
import { PACKAGE_ROOT, userSkillsDirsFor, VERSION } from './paths';
import { select } from './selector';
import { OFFICIAL_SKILLS } from './skill-identity';
import type { DisplayMode } from './ui';
import { checkForUpdate } from './update-check';
import {
  applyManagedPairs,
  classifyManagedImpact,
  classifyManagedPairs,
  collectManagedPairs,
  detectExecutionMode,
  formatCheckReport,
  managedHashesForPairs,
  readInstallProvenance,
  runNpmGlobalInstall,
  runNpmSkillsUpgrade,
  writeInstallProvenance,
} from './upgrade';

// The `upgrade` command: registry check, confirm-gated CLI update, and selective
// reconciliation of installed official skills.

type UpgradeCommandOptions = {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
  ascii?: boolean | undefined;
  interactive?: boolean | undefined;
  homeDir?: string | undefined;
  check?: boolean | undefined;
  plan?: boolean | undefined;
  skillsOnly?: boolean | undefined;
  [key: string]: unknown;
};

function log(status: string, message: string) {
  logStatus(status, message, projectLocale(process.cwd()));
}

async function askYesNo(question: string) {
  const result = await select(question.replace(/\s*\[[^\]]+\]\s*$/, ''), [
    { value: 'continue', label: 'Continue' },
    { value: 'cancel', label: 'Cancel', action: true },
  ]);
  return !result.cancelled && result.value === 'continue';
}

function canPromptInteractively(mode: DisplayMode = resolveMode()) {
  return (
    mode !== 'machine' &&
    shouldShowInteractiveMenu({ stdout: process.stdout, stdin: process.stdin }, process.env)
  );
}

function refreshSkillsAtTarget(
  target: string,
  {
    overwriteDiffers = false,
    overwritePaths,
  }: { overwriteDiffers?: boolean; overwritePaths?: ReadonlySet<string> } = {},
) {
  const pairs = collectManagedPairs(PACKAGE_ROOT, OFFICIAL_SKILLS, target);
  const classified = classifyManagedPairs(pairs);
  const missing = applyManagedPairs(classified.missing, { overwriteDiffers: true });
  const eligibleDiffers = classified.differs.filter(
    (pair) => !overwritePaths || overwritePaths.has(pair.rel),
  );
  const changed = overwriteDiffers
    ? applyManagedPairs(eligibleDiffers, { overwriteDiffers: true })
    : {
        installed: 0,
        refreshed: 0,
        skippedIdentical: 0,
        skippedDiffers: eligibleDiffers.length,
      };
  const totals = {
    installed: missing.installed,
    refreshed: changed.refreshed,
    skippedIdentical: classified.identical.length,
    skippedDiffers: changed.skippedDiffers + classified.differs.length - eligibleDiffers.length,
    differs: classified.differs.map((pair) => pair.rel),
  };
  writeInstallProvenance(target, {
    packageVersion: VERSION,
    managedSkills: [...OFFICIAL_SKILLS],
    managedPaths: pairs.map((pair) => pair.rel),
    managedHashes: managedHashesForPairs(pairs),
  });
  return totals;
}

async function refreshInstalledSkills(cwd: string, options: UpgradeCommandOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  const interactive = Boolean(options.interactive && canPromptInteractively(mode));
  const skillsRoot = resolveSkillsRoot(cwd);
  const projectRoot = path.join(cwd, '.agents', 'skills');
  const targets: string[] = [];
  if (hasOfficialSkillsAt(projectRoot) || installationStatus(projectRoot))
    targets.push(projectRoot);
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd), options.homeDir) ?? [])
    if (installationStatus(dir) && !targets.includes(dir)) targets.push(dir);
  if (!targets.length) targets.push(skillsRoot);

  for (const target of targets) {
    const provenance = readInstallProvenance(target);
    if (provenance && provenance.schema !== 'saf-install-provenance/v3') {
      log('FAIL', `provenance ${provenance.schema} requires a clean v7 reinstall`);
      return { ok: false, blocked: true };
    }
  }

  const targetPlans = targets.map((target) => {
    const provenance = readInstallProvenance(target);
    const pairs = collectManagedPairs(PACKAGE_ROOT, OFFICIAL_SKILLS, target);
    const classified = classifyManagedPairs(pairs);
    const impact = classifyManagedImpact(classified.differs, provenance);
    return {
      target,
      overwritePaths: new Set(
        [...impact.packageChanged, ...impact.unknown].map((pair) => pair.rel),
      ),
      affected: [...impact.packageChanged, ...impact.unknown],
      localOnly: impact.localOnly,
    };
  });
  const allDiffers = targetPlans.flatMap(({ target, affected }) =>
    affected.map((pair) => `${target}: ${pair.rel}`),
  );
  const localOnlyCount = targetPlans.reduce((total, plan) => total + plan.localOnly.length, 0);
  if (localOnlyCount) log('INFO', `${localOnlyCount} locally changed managed file(s) preserved`);
  let overwriteDiffers = false;
  if (allDiffers.length) {
    log('WARN', `${allDiffers.length} managed file(s) differ from the bundled package`);
    for (const line of allDiffers.slice(0, 20)) process.stdout.write(`  ${line}\n`);
    if (interactive)
      overwriteDiffers = await askYesNo(
        'Overwrite differing managed files with the bundled package?',
      );
    else log('WARN', 'non-interactive: never overwriting differing managed files');
  }

  let wrote = 0;
  let skippedDiffers = 0;
  for (const plan of targetPlans) {
    const summary = refreshSkillsAtTarget(plan.target, {
      overwriteDiffers,
      overwritePaths: plan.overwritePaths,
    });
    wrote += summary.installed + summary.refreshed;
    skippedDiffers += summary.skippedDiffers;
    log(
      'PASS',
      `reconciled official bundle at ${plan.target}: ${summary.installed} new, ${summary.refreshed} updated, ${summary.skippedIdentical} identical, ${summary.skippedDiffers} differed (skipped)`,
    );
  }
  return { ok: true, wrote, skippedDiffers };
}

type UpgradeOutcome = {
  status: 'PASS' | 'WARN' | 'INFO' | 'FAIL';
  message: string;
  cancelled?: boolean;
};

async function upgradeCommand(
  cwd: string,
  options: UpgradeCommandOptions = {},
): Promise<UpgradeOutcome> {
  const mode = resolveMode({ quiet: options.quiet, ascii: Boolean(options.ascii) });
  const interactive = canPromptInteractively(mode) && !options.check && !options.plan;
  const execMode = detectExecutionMode(PACKAGE_ROOT);

  if (options.skillsOnly) {
    if (options.plan) {
      process.stdout.write(
        `Execution mode: ${execMode}\n` +
          `Registry check: none (--skills-only)\n` +
          `CLI package: unchanged\n` +
          `Plan:\n  1. Reconcile the official bundle from the currently executing package (${VERSION})\n\n` +
          'Mutations (if applied):\n  missing or changed managed skill files (after confirms / diff rules)\n\n' +
          'No changes were made.\n',
      );
      return { status: 'INFO', message: 'No changes were made.' };
    }
    const refreshed = await refreshInstalledSkills(cwd, {
      mode,
      interactive,
      homeDir: options.homeDir,
    });
    if (!refreshed.ok) return { status: 'FAIL', message: 'Skill reconciliation was blocked.' };
    return {
      status: refreshed.skippedDiffers ? 'WARN' : 'PASS',
      message: refreshed.wrote
        ? `Reconciled ${refreshed.wrote} managed file(s).`
        : 'Installed skills are already current.',
    };
  }

  const result = await checkForUpdate({ currentVersion: VERSION });

  if (options.check || (!interactive && !options.plan)) {
    process.stdout.write(formatCheckReport(result));
    if (!result.reachable) {
      process.stdout.write(
        `\nNo changes were made.\n\nTo retry:\n  ${renderCliCommand('upgrade')}\n`,
      );
      process.exitCode = 1;
      return { status: 'INFO', message: 'Unable to check for updates.' };
    }
    if (!options.check && result.updateAvailable) {
      process.stdout.write(
        '\nThis invocation is non-interactive; no mutations were performed.\n' +
          `Run \`${renderCliCommand('upgrade')}\` in a TTY to confirm CLI/skills updates.\n`,
      );
    }
    return {
      status: result.updateAvailable ? 'WARN' : 'PASS',
      message: result.message,
    };
  }

  if (options.plan) {
    if (!result.reachable) {
      log('WARN', 'unable to check for updates');
      process.stdout.write(
        `\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  ${renderCliCommand('upgrade', '--plan')}\n`,
      );
      process.exitCode = 1;
      return { status: 'INFO', message: 'Unable to check for updates.' };
    }
    process.stdout.write(
      `Current CLI: ${VERSION}\n` +
        `Latest CLI: ${result.latest}\n` +
        `Execution mode: ${execMode}\n\n` +
        'Plan:\n',
    );
    if (result.updateAvailable) {
      if (execMode === 'global')
        process.stdout.write(`  1. Upgrade CLI -> ${result.latest} (npm install -g)\n`);
      else
        process.stdout.write(
          `  1. Run the verified package: npm exec --yes sdd-agentic-flow@${result.latest} -- upgrade --skills-only\n`,
        );
      process.stdout.write(
        '  2. Reconcile only missing or changed skill/shared files from the new package\n',
      );
    } else {
      process.stdout.write('  1. CLI already up to date — no package install\n');
      process.stdout.write('  2. Reconcile skills only when files are missing or changed\n');
    }
    process.stdout.write(
      '\nMutations (if applied):\n  npm global installation (global mode only)\n' +
        '  managed skill files (after confirms / diff rules)\n\nNo changes were made.\n',
    );
    return { status: 'INFO', message: 'No changes were made.' };
  }

  if (!result.reachable) {
    log('WARN', 'unable to check for updates');
    process.stdout.write(
      `\nReason:\n  network unavailable or registry unreachable\n\nNo changes were made.\n\nTo retry:\n  ${renderCliCommand('upgrade')}\n`,
    );
    return { status: 'INFO', message: 'Unable to check for updates.' };
  }

  if (!result.updateAvailable || !result.latest) {
    log('PASS', `up to date (${VERSION})`);
    process.stdout.write('\nNo update is required.\n');
    process.stdout.write(
      `To reconcile skills deliberately, run ${renderCliCommand('upgrade', '--skills-only')}.\n`,
    );
    return { status: 'PASS', message: 'No update is required.' };
  }

  log('WARN', `update available: ${VERSION} -> ${result.latest}`);
  if (!(await askYesNo(`Upgrade CLI to ${result.latest} and reconcile affected skills now?`))) {
    return {
      status: 'INFO',
      cancelled: true,
      message: 'CLI and skill updates were cancelled; no changes were made.',
    };
  }

  try {
    if (execMode === 'global') {
      process.stdout.write('Updating the global SAF installation...\n');
      runNpmGlobalInstall({ version: result.latest });
    }
    runNpmSkillsUpgrade({ version: result.latest });
    return {
      status: 'PASS',
      message: `CLI ${result.latest} is active and affected skills were reconciled selectively.`,
    };
  } catch (error) {
    const message = errorMessage(error);
    fail(`CLI upgrade failed: ${message}`, {
      reason: 'The verified npm package or its selective skill reconciliation exited non-zero.',
      try: [
        `npm exec --yes sdd-agentic-flow@${result.latest} -- upgrade --skills-only`,
        renderCliCommand('upgrade', '--plan'),
      ],
    });
    return { status: 'FAIL', message };
  }
}

export type { UpgradeCommandOptions, UpgradeOutcome };
export { upgradeCommand };
