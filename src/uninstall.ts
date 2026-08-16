import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { USAGE } from './cli-help';
import { languageReport } from './doctor';
import { targetLabelFor } from './install-preflight';
import { resolveLocale, t, translateText } from './messages';
import { KNOWN_AGENTS, sddJoin, userSkillsDirsFor } from './paths';
import { OFFICIAL_SKILLS } from './skill-identity';
import { shortenPath, styleStatus } from './ui';

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

export function uninstall(args: string[], cwd: string): boolean | undefined {
  const usage = USAGE.uninstall;
  const plan = args.includes('--plan');
  const apply = args.includes('--apply');
  const full = args.includes('--full');
  const includeConfig = args.includes('--include-config') || full;
  const quiet = args.includes('--quiet');
  const verbose = args.includes('--verbose');
  let scope: string | null = null;
  let agent: string | null = null;
  const rest: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = asString(args[index]);
    if (['--plan', '--apply', '--include-config', '--full', '--verbose', '--quiet'].includes(arg))
      continue;
    if (arg === '--scope' && ['user', 'project'].includes(asString(args[index + 1]))) {
      scope = asString(args[index + 1]);
      index += 1;
    } else if (arg === '--agent' && KNOWN_AGENTS.includes(asString(args[index + 1]))) {
      agent = asString(args[index + 1]);
      index += 1;
    } else rest.push(arg);
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
  // --full additionally clears regenerable local state (context, snapshots, reports, usage.md).
  // .specs/features is never a target here, in any mode: it holds hand-authored specs, the
  // same "preserved like source code" invariant documented throughout uninstall.md/upgrading.md.
  if (full) {
    targets.push(
      sddJoin(cwd, 'context', 'project-context.md'),
      sddJoin(cwd, 'snapshots'),
      sddJoin(cwd, 'reports'),
      sddJoin(cwd, 'usage.md'),
    );
  }
  const existing = targets.filter((target: string) => fs.existsSync(target));
  const locale = localeFor(cwd);
  if (plan) {
    const grouped = new Map();
    for (const target of existing) {
      const root =
        roots.find(
          (candidate: unknown) =>
            target === candidate || target.startsWith(`${candidate}${path.sep}`),
        ) || path.dirname(target);
      if (!grouped.has(root)) grouped.set(root, []);
      grouped.get(root).push(target);
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
