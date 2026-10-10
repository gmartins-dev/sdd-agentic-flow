import fs from 'node:fs';
import path from 'node:path';

import { logStatus, renderNextStep, resolveMode } from './cli-output';
import { renderPolicySummary } from './config';
import { type ReadConfigResult, readConfig } from './config-domain';
import {
  installationStatus,
  officialSkillsPresence,
  projectLocale,
  resolveConfiguredAgent,
  resolveSkillsRoot,
} from './doctor';
import { targetLabelFor } from './install-preflight';
import { t } from './messages';
import { SDD_PATHS, sddJoin, userSkillsDirsFor } from './paths';
import { terminalWelcome } from './terminal-ui';
import { type DisplayMode, renderKeyValue, renderSection } from './ui';

type InstallationSummary = {
  mode: string;
  targets: string[];
};

type WelcomeOptions = {
  mode?: DisplayMode | undefined;
  quiet?: boolean | undefined;
  ascii?: boolean | undefined;
};

function log(status: string, message: string) {
  logStatus(status, message, projectLocale(process.cwd()));
}

function nextStep(line: string, options: WelcomeOptions) {
  renderNextStep(line, options, projectLocale(process.cwd()));
}

function renderInstallationSummaryBlock(
  summary: InstallationSummary,
  mode: DisplayMode,
  locale = 'en-US',
) {
  const lines = [];
  lines.push(...renderSection(locale === 'pt-BR' ? 'Instalação' : 'Installation', mode));
  lines.push(...renderKeyValue(locale === 'pt-BR' ? 'Modelo' : 'Mode', summary.mode, mode));
  lines.push(
    ...renderKeyValue(
      locale === 'pt-BR' ? 'Destinos' : 'Targets',
      summary.targets.length ? summary.targets.join(', ') : '(none detected)',
      mode,
    ),
  );
  return lines.join('\n');
}

function renderPolicySummaryBlock(config: ReadConfigResult, mode: DisplayMode, locale = 'en-US') {
  return renderPolicySummary(config, mode, locale);
}

function installationSummaryForWelcome(cwd: string) {
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const mode =
    skillsRoot === projectScopeRoot && fs.existsSync(projectScopeRoot)
      ? 'Project / Team'
      : 'Local / User';
  const targets = [];
  for (const dir of userSkillsDirsFor(resolveConfiguredAgent(cwd)) ?? []) {
    if (installationStatus(dir)) targets.push(targetLabelFor(dir));
  }
  if (mode === 'Project / Team' && installationStatus(projectScopeRoot)) {
    targets.push('Project .agents/skills');
  }
  return { mode, targets: [...new Set(targets)] };
}

// Bare `npx sdd-agentic-flow` (no command) always prints this read-only status screen first —
// it detects state and points at exactly one next command, and never mutates anything on its
// own. When the process is genuinely interactive (both stdout and stdin are a real TTY, and
// process.env.CI is not set — see bin/menu.js's shouldShowInteractiveMenu). The bare command
// remains a status-only surface in every environment; mutations require an explicit command.
async function welcome(cwd: string, options: WelcomeOptions = {}) {
  const mode = options.mode ?? resolveMode(options);
  const locale = projectLocale(cwd);
  const configPath = sddJoin(cwd, 'config.yml');
  const configFound = fs.existsSync(configPath);
  const projectScopeRoot = path.join(cwd, '.agents', 'skills');
  const skillsRoot = resolveSkillsRoot(cwd);
  const presence = officialSkillsPresence(skillsRoot);
  const skillsInstalled = presence.complete;
  const skillsPartial = presence.partial;
  const workspaceFound = fs.existsSync(path.join(cwd, SDD_PATHS.workspace));

  await terminalWelcome(locale, { mode, output: process.stdout });

  const configLabel = configFound
    ? `${SDD_PATHS.config} ${t(locale, 'welcome.configFound')}`
    : `${SDD_PATHS.config} ${t(locale, 'welcome.configMissing')}`;
  const skillsLabel = skillsInstalled
    ? `${t(locale, 'welcome.skillsInstalled')} (${skillsRoot === projectScopeRoot ? 'project' : 'user'} scope: ${skillsRoot})`
    : skillsPartial
      ? `partial skill install detected (${presence.present.length} present) — re-run \`npx sdd-agentic-flow install\` to repair`
      : `${t(locale, 'welcome.noSkills')} (project or user scope)`;
  const workspaceLabel = workspaceFound
    ? locale === 'pt-BR'
      ? 'workspace inicializado'
      : 'workspace initialized'
    : locale === 'pt-BR'
      ? 'workspace ainda não inicializado'
      : 'workspace not initialized';

  if (mode === 'human-rich') {
    log(
      configFound ? 'PASS' : 'INFO',
      configFound ? t(locale, 'welcome.configFound') : t(locale, 'welcome.configMissing'),
    );
    log(
      skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO',
      skillsInstalled
        ? t(locale, 'welcome.skillsInstalled')
        : skillsPartial
          ? skillsLabel
          : t(locale, 'welcome.noSkills'),
    );
    log(workspaceFound ? 'PASS' : 'INFO', workspaceLabel);
    const config = readConfig(configPath);
    if (config.ok) {
      process.stdout.write(`\n${renderPolicySummaryBlock(config, mode, locale)}\n`);
    }
    if (skillsInstalled || skillsPartial) {
      const installSummary = installationSummaryForWelcome(cwd);
      process.stdout.write(`\n${renderInstallationSummaryBlock(installSummary, mode, locale)}\n`);
    }
  } else {
    log(configFound ? 'PASS' : 'INFO', configLabel);
    log(skillsInstalled ? 'PASS' : skillsPartial ? 'WARN' : 'INFO', skillsLabel);
    log(workspaceFound ? 'PASS' : 'INFO', workspaceLabel);
  }

  const suggested = !skillsInstalled
    ? 'npx sdd-agentic-flow install'
    : !workspaceFound
      ? 'npx sdd-agentic-flow init'
      : 'Use your coding agent with the installed SAF workflow.';
  if (mode === 'machine') {
    // Compact status screen (CLI-001): contextual next + quick commands; not nextStep().
    process.stdout.write(
      `\n${t(locale, 'init.next')}\n` +
        `  ${suggested}\n\n` +
        `${t(locale, 'welcome.quickCommands')}\n` +
        (!skillsInstalled
          ? '  npx sdd-agentic-flow install            Install the official skill bundle\n  npx sdd-agentic-flow config installation  Change installation intent\n  npx sdd-agentic-flow doctor             Validate local setup\n'
          : !workspaceFound
            ? '  npx sdd-agentic-flow init               Initialize this workspace\n  npx sdd-agentic-flow doctor             Validate local setup\n'
            : '  npx sdd-agentic-flow doctor             Validate local setup\n  npx sdd-agentic-flow config policy      Change operating policy\n  npx sdd-agentic-flow uninstall --plan   Preview what would be removed\n') +
        '\n' +
        `${t(locale, 'welcome.help')}\n\n` +
        `${t(locale, 'welcome.update')}\n` +
        '  npx sdd-agentic-flow upgrade\n' +
        '  (read-only: doctor --check-updates / upgrade --check)\n',
    );
  } else {
    nextStep(suggested, { quiet: options.quiet, mode });
    process.stdout.write(
      !skillsInstalled
        ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow install --plan\n  npx sdd-agentic-flow config installation\n  npx sdd-agentic-flow doctor\n`
        : !workspaceFound
          ? `\n${t(locale, 'welcome.quickCommands')}\n  npx sdd-agentic-flow init --plan\n  npx sdd-agentic-flow doctor\n`
          : `\n${t(locale, 'welcome.optionalMaintenance')}\n  npx sdd-agentic-flow doctor\n  npx sdd-agentic-flow config policy\n  npx sdd-agentic-flow context refresh\n  npx sdd-agentic-flow upgrade\n  npx sdd-agentic-flow uninstall --plan\n`,
    );
    process.stdout.write(
      `\n${t(locale, 'welcome.update')}\n` +
        '  npx sdd-agentic-flow upgrade\n' +
        '  (read-only: doctor --check-updates / upgrade --check)\n',
    );
  }
}

export { welcome };
