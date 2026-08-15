'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  DEFAULT_USER_TARGETS,
  defaultInstallConfig,
  readInstallConfig,
  repositoryKey,
  writeInstallConfig,
} = require('./install-domain');

const EXCLUDE_BLOCK = '# sdd-agentic-flow project-local skills\n.agents/skills/\n';

function applyProjectSharing(cwd, sharing) {
  const dotGit = path.join(cwd, '.git');
  if (!fs.existsSync(dotGit)) return { changed: false, warning: 'Git unavailable' };
  let gitDir = dotGit;
  if (fs.statSync(dotGit).isFile()) {
    const match = fs.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)\s*$/m);
    if (!match) return { changed: false, warning: 'Git directory unavailable' };
    gitDir = path.resolve(cwd, match[1]);
  }
  const exclude = path.join(gitDir, 'info', 'exclude');
  const current = fs.existsSync(exclude) ? fs.readFileSync(exclude, 'utf8') : '';
  const next =
    sharing === 'local'
      ? current.includes(EXCLUDE_BLOCK)
        ? current
        : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${EXCLUDE_BLOCK}`
      : current.replace(EXCLUDE_BLOCK, '');
  if (next !== current) {
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    fs.writeFileSync(exclude, next, 'utf8');
  }
  return { changed: next !== current };
}

function resolveProfile(config, { scope = 'user', cwd }) {
  if (scope === 'user') return { kind: 'user', profile: config.user };
  const key = repositoryKey(cwd);
  return {
    kind: 'project',
    key,
    profile: config.projects[key] || { root: cwd, packs: [], sharing: 'shared' },
  };
}

function configureIntent({ homeDir, cwd, scope = 'user', packs, targets, sharing, plan = false }) {
  const config = readInstallConfig(homeDir) || defaultInstallConfig();
  const resolved = resolveProfile(config, { scope, cwd });
  const next = { ...resolved.profile };
  if (packs?.length) next.packs = [...new Set(packs)];
  if (scope === 'user' && targets?.length) next.targets = [...new Set(targets)];
  if (scope === 'user' && !next.targets?.length) next.targets = [...DEFAULT_USER_TARGETS];
  if (scope === 'project') {
    next.root = cwd;
    next.sharing = sharing || next.sharing || 'shared';
  }
  if (!plan) {
    if (scope === 'user') config.user = next;
    else config.projects[resolved.key] = next;
    writeInstallConfig(config, homeDir);
    if (scope === 'project' && sharing) applyProjectSharing(cwd, next.sharing);
  }
  return { before: resolved.profile, after: next, wrote: !plan };
}

module.exports = { applyProjectSharing, configureIntent };
