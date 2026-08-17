import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { USAGE } from './cli-help';
import { languageReport } from './doctor';
import { targetLabelFor } from './install-preflight';
import { resolveLocale, t, translateText } from './messages';
import {
  DEFAULT_USER_DIR_SEGMENTS,
  KNOWN_AGENTS,
  LOCAL_GIT_EXCLUDE_COMMENT,
  LOCAL_GIT_EXCLUDE_ENTRY,
  projectSddRoot,
  SDD_ROOT,
  sddJoin,
  userInstallConfigPath,
  userSkillsDirsFor,
} from './paths';
import { listManagedSkillDirNames, OFFICIAL_SKILLS } from './skill-identity';
import { shortenPath, styleStatus } from './ui';

type PurgeTarget = { path: string; kind: string; preserve?: boolean; reason?: string };

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function localeFor(cwd: string, explicit?: string) {
  return resolveLocale({ explicit, configured: languageReport(cwd).profile });
}

function log(status: string, message: string, explicitLocale?: string) {
  const locale = explicitLocale || localeFor(process.cwd());
  process.stdout.write(
    `${styleStatus(status, process.stdout)} ${translateText(locale, message)}\n`,
  );
}

function fail(message: string, code = 1) {
  process.stderr.write(`${styleStatus('FAIL', process.stderr)} ${message}\n`);
  process.exitCode = code;
  return false;
}

function describePath(cwd: string, target: string) {
  const relative = path.relative(cwd, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? target : relative;
}

function skillsRoots(cwd: string, homeDir: string): string[] {
  const projectRoot = path.join(cwd, '.agents', 'skills');
  const userRoots = DEFAULT_USER_DIR_SEGMENTS.map((parts) => path.join(homeDir, ...parts));
  return [projectRoot, ...userRoots];
}

function collectSkillTargets(root: string): PurgeTarget[] {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root);
  return listManagedSkillDirNames(entries).map((name) => ({
    path: path.join(root, name),
    kind: name === 'sdd-agentic-flow-shared' ? 'shared' : 'skill',
  }));
}

function legacySddOwnershipProven(cwd: string): boolean {
  const legacyRoot = path.join(cwd, '.sdd');
  if (!fs.existsSync(legacyRoot)) return false;
  const entries = fs.readdirSync(legacyRoot);
  return entries.some(
    (name) =>
      listManagedSkillDirNames([name]).length > 0 ||
      name === 'config.yml' ||
      name === 'install.yml',
  );
}

export function collectPurgeTargets(cwd: string, homeDir: string = os.homedir()): PurgeTarget[] {
  const targets: PurgeTarget[] = [];
  for (const root of skillsRoots(cwd, homeDir)) {
    targets.push(...collectSkillTargets(root));
  }
  const projectState = projectSddRoot(cwd);
  if (fs.existsSync(projectState)) {
    targets.push({ path: projectState, kind: 'project-state' });
  }
  const userInstall = userInstallConfigPath(homeDir);
  if (fs.existsSync(userInstall)) {
    targets.push({ path: userInstall, kind: 'user-install-intent' });
  }
  const userState = path.join(homeDir, SDD_ROOT);
  if (fs.existsSync(userState) && userState !== projectState) {
    targets.push({ path: userState, kind: 'user-state' });
  }
  const gitExclude = path.join(cwd, '.git', 'info', 'exclude');
  if (fs.existsSync(gitExclude)) {
    const content = fs.readFileSync(gitExclude, 'utf8');
    if (content.includes(LOCAL_GIT_EXCLUDE_COMMENT) && content.includes(LOCAL_GIT_EXCLUDE_ENTRY)) {
      targets.push({ path: gitExclude, kind: 'git-exclude-block' });
    }
  }
  const legacyRoot = path.join(cwd, '.sdd');
  if (fs.existsSync(legacyRoot)) {
    if (legacySddOwnershipProven(cwd)) {
      targets.push({ path: legacyRoot, kind: 'legacy-sdd-root' });
    } else {
      targets.push({
        path: legacyRoot,
        kind: 'legacy-sdd-root',
        preserve: true,
        reason: 'ambiguous ownership — not SAF-managed',
      });
    }
  }
  return targets;
}

function removeGitExcludeBlock(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const kept: string[] = [];
  let skipping = false;
  for (const line of lines) {
    if (line.trim() === LOCAL_GIT_EXCLUDE_COMMENT) {
      skipping = true;
      continue;
    }
    if (skipping && line.trim() === LOCAL_GIT_EXCLUDE_ENTRY) {
      skipping = false;
      continue;
    }
    if (!skipping) kept.push(line);
  }
  const next = kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  if (next) fs.writeFileSync(filePath, `${next}\n`);
  else fs.rmSync(filePath, { force: true });
}

function applyPurge(targets: PurgeTarget[], cwd: string) {
  for (const target of targets) {
    if (target.preserve) {
      log('INFO', `preserved ${describePath(cwd, target.path)} (${target.reason ?? 'protected'})`);
      continue;
    }
    if (target.kind === 'git-exclude-block') removeGitExcludeBlock(target.path);
    else fs.rmSync(target.path, { recursive: true, force: true });
    log('PASS', `removed ${describePath(cwd, target.path)}`);
  }
}

function verifyPurge(cwd: string, homeDir: string): string[] {
  const remaining = collectPurgeTargets(cwd, homeDir).filter((target) => !target.preserve);
  return remaining.filter((target) => fs.existsSync(target.path)).map((target) => target.path);
}

export function uninstall(args: string[], cwd: string): boolean | undefined {
  const usage = USAGE.uninstall;
  const plan = args.includes('--plan');
  const apply = args.includes('--apply');
  const full = args.includes('--full');
  const purge = args.includes('--purge');
  const includeConfig = args.includes('--include-config') || full;
  const yes = args.includes('--yes');
  const quiet = args.includes('--quiet');
  const verbose = args.includes('--verbose');
  let scope: string | null = null;
  let agent: string | null = null;
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = asString(args[index]);
    if (
      [
        '--plan',
        '--apply',
        '--include-config',
        '--full',
        '--purge',
        '--yes',
        '--verbose',
        '--quiet',
      ].includes(arg)
    )
      continue;
    if (arg === '--scope' && ['user', 'project'].includes(asString(args[index + 1]))) {
      scope = asString(args[index + 1]);
      index += 1;
    } else if (arg === '--agent' && KNOWN_AGENTS.includes(asString(args[index + 1]))) {
      agent = asString(args[index + 1]);
      index += 1;
    } else rest.push(arg);
  }

  if (purge) {
    if (scope || agent || full || includeConfig || rest.length) {
      return fail(
        `${usage} — --purge cannot combine with --scope, --agent, --full, or --include-config`,
      );
    }
    if (apply && !yes) {
      return fail(`${usage} — --apply --purge requires --yes`);
    }
    if (plan === apply) {
      return fail(`${usage} — specify exactly one of --plan or --apply with --purge`);
    }
    const homeDir = os.homedir();
    const targets = collectPurgeTargets(cwd, homeDir);
    const removable = targets.filter((target) => !target.preserve);
    const preserved = targets.filter((target) => target.preserve);
    const locale = localeFor(cwd);
    if (plan) {
      process.stdout.write(`${t(locale, 'uninstall.plan')} (purge)\n\n`);
      for (const target of removable) {
        process.stdout.write(`  ${target.kind}: ${describePath(cwd, target.path)}\n`);
      }
      process.stdout.write(`\n${removable.length} recognized SAF targets\n\n`);
      for (const target of preserved) {
        process.stdout.write(
          `  preserved: ${describePath(cwd, target.path)} — ${target.reason ?? 'protected'}\n`,
        );
      }
      process.stdout.write(
        `\n${t(locale, 'uninstall.preserved')}\n  .specs/features/**, source code, foreign skills, unrecognized paths\n\n${t(locale, 'plan.noChanges')}\n${t(locale, 'uninstall.apply')}: sdd-agentic-flow uninstall --apply --purge --yes\n`,
      );
      return;
    }
    if (apply) {
      applyPurge(removable, cwd);
      const left = verifyPurge(cwd, homeDir);
      if (left.length) {
        for (const entry of left) log('WARN', `recognized target remains: ${entry}`);
      } else if (!quiet) log('PASS', 'purge verification complete — no recognized targets remain');
      if (!quiet) {
        log('PASS', 'preserved feature specs, source code, Git history, and foreign skills');
        process.stdout.write(
          '\nNext step: npx sdd-agentic-flow init && npx sdd-agentic-flow install core\n',
        );
      }
      return true;
    }
    return fail(`${usage} — --purge requires --plan or --apply`);
  }

  if (plan === apply || rest.length || ((includeConfig || full) && !apply))
    return fail(
      plan === apply && !plan
        ? `${usage} — run \`sdd-agentic-flow uninstall --plan\` first; it never removes anything.`
        : usage,
    );
  const scopes = scope ? [scope] : ['project', 'user'];
  const roots = [];
  if (scopes.includes('project')) roots.push(path.join(cwd, '.agents', 'skills'));
  if (scopes.includes('user')) {
    const userDirs = userSkillsDirsFor(agent);
    if (userDirs) roots.push(...userDirs);
  }
  const targets = roots.flatMap((root: string) => {
    const hasOwnedSkill = OFFICIAL_SKILLS.some((skill: string) =>
      fs.existsSync(path.join(root, skill, 'SKILL.md')),
    );
    if (!hasOwnedSkill && scope !== 'project' && root !== path.join(cwd, '.agents', 'skills'))
      return [];
    return [
      ...OFFICIAL_SKILLS.map((skill: string) => path.join(root, skill)),
      path.join(root, 'sdd-agentic-flow-shared'),
    ];
  });
  if (includeConfig) targets.push(sddJoin(cwd, 'config.yml'));
  if (full) {
    targets.push(
      sddJoin(cwd, 'context', 'project-context.md'),
      sddJoin(cwd, 'snapshots'),
      sddJoin(cwd, 'reports'),
      sddJoin(cwd, 'usage.md'),
      sddJoin(cwd, 'saf-skills-usage-guide.md'),
      sddJoin(cwd, 'saf-skills-usage-guide.pt-BR.md'),
      sddJoin(cwd, 'explanations'),
    );
  }
  const existing = targets.filter((target: string) => fs.existsSync(target));
  const locale = localeFor(cwd);
  if (plan) {
    const grouped = new Map<string, string[]>();
    for (const target of existing) {
      const root =
        roots.find(
          (candidate: unknown) =>
            target === candidate || target.startsWith(`${candidate}${path.sep}`),
        ) || path.dirname(target);
      if (!grouped.has(root)) grouped.set(root, []);
      grouped.get(root)?.push(target);
    }
    process.stdout.write(`${t(locale, 'uninstall.plan')}\n\n`);
    for (const [root, paths] of grouped) {
      process.stdout.write(
        `${targetLabelFor(root)} (${shortenPath(root, { homeDir: os.homedir(), cwd })})\n`,
      );
      const skills = paths.filter((entry: string) =>
        path.basename(entry).startsWith('saf-'),
      ).length;
      const shared = paths.some(
        (entry: string) => path.basename(entry) === 'sdd-agentic-flow-shared',
      );
      process.stdout.write(`  ${skills} managed skills${shared ? ' + shared support' : ''}\n`);
      if (verbose)
        for (const target of paths) process.stdout.write(`  ${describePath(cwd, target)}\n`);
      process.stdout.write('\n');
    }
    process.stdout.write(
      `${t(locale, 'uninstall.summary')}\n  ${existing.length} managed paths\n\n`,
    );
    if (!existing.length) process.stdout.write(`  ${t(locale, 'uninstall.nothing')}\n\n`);
    process.stdout.write(
      `${t(locale, 'uninstall.preserved')}\n  .specs/features/**, source code, unknown/unmanaged paths\n\n${t(locale, 'plan.noChanges')}\n${t(locale, 'uninstall.apply')}: sdd-agentic-flow uninstall --apply\n`,
    );
    return;
  }
  for (const target of existing) {
    fs.rmSync(target, { recursive: true, force: true });
    log('PASS', `removed ${describePath(cwd, target)}`);
  }
  if (!existing.length) log('WARN', 'nothing installed by sdd-agentic-flow was found');
  if (!quiet)
    log(
      'PASS',
      full
        ? 'preserved project specs, source code, and unknown paths'
        : 'preserved project specs, reports, snapshots, source code, and unknown paths',
    );
  return true;
}
