'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const USER_TARGETS = Object.freeze({
  agents: ['.agents', 'skills'],
  cursor: ['.cursor', 'skills'],
  claude: ['.claude', 'skills'],
  copilot: ['.copilot', 'skills'],
});
const DEFAULT_USER_TARGETS = Object.freeze(['agents', 'claude', 'copilot']);
const AGENT_TO_TARGETS = Object.freeze({
  codex: ['agents'],
  cursor: ['agents', 'cursor'],
  'claude-code': ['claude'],
  'vscode-copilot': ['copilot'],
});

function installConfigPath(homeDir = os.homedir()) {
  return path.join(homeDir, '.sdd-agentic-flow', 'install.yml');
}

function repositoryKey(root) {
  return crypto.createHash('sha256').update(fs.realpathSync(root)).digest('hex').slice(0, 16);
}

function defaultInstallConfig() {
  return { version: 1, user: { packs: [], targets: [] }, projects: {} };
}

function yamlList(lines, indent, values) {
  for (const value of values) lines.push(`${' '.repeat(indent)}- ${value}`);
}

function serializeInstallConfig(config) {
  const lines = [`version: ${config.version ?? 1}`, '', 'user:', '  packs:'];
  yamlList(lines, 4, config.user?.packs || []);
  lines.push('  targets:');
  yamlList(lines, 4, config.user?.targets || []);
  lines.push('', 'projects:');
  for (const [key, profile] of Object.entries(config.projects || {})) {
    lines.push(`  "${key}":`, `    root: "${profile.root}"`, '    packs:');
    yamlList(lines, 6, profile.packs || []);
    lines.push(`    sharing: ${profile.sharing || 'shared'}`);
  }
  return `${lines.join('\n')}\n`;
}

function parseList(lines, start, indent) {
  const values = [];
  let index = start;
  while (index < lines.length && lines[index].startsWith(`${' '.repeat(indent)}- `)) {
    values.push(lines[index].trim().slice(2));
    index += 1;
  }
  return { values, index };
}

function readInstallConfig(homeDir) {
  const file = installConfigPath(homeDir);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const config = defaultInstallConfig();
  let section = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === 'user:') section = 'user';
    else if (line === 'projects:') section = 'projects';
    else if (section === 'user' && /^ {2}(packs|targets):$/.test(line)) {
      const key = line.trim().slice(0, -1);
      const parsed = parseList(lines, index + 1, 4);
      config.user[key] = parsed.values;
      index = parsed.index - 1;
    } else if (section === 'projects' && /^ {2}"[^"]+":$/.test(line)) {
      const key = line.trim().slice(1, -2);
      const profile = { packs: [], sharing: 'shared' };
      for (index += 1; index < lines.length && lines[index].startsWith('    '); index += 1) {
        const child = lines[index].trim();
        if (child.startsWith('root: ')) profile.root = child.slice(6).replace(/^"|"$/g, '');
        else if (child === 'packs:') {
          const parsed = parseList(lines, index + 1, 6);
          profile.packs = parsed.values;
          index = parsed.index - 1;
        } else if (child.startsWith('sharing: ')) profile.sharing = child.slice(9);
      }
      config.projects[key] = profile;
      index -= 1;
    }
  }
  return config;
}

function writeInstallConfig(config, homeDir) {
  const file = installConfigPath(homeDir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, serializeInstallConfig(config), 'utf8');
  fs.renameSync(temporary, file);
}

function desiredSkillsForPacks(packs, presets) {
  return [...new Set(packs.flatMap((pack) => presets[pack]?.skills || []))].sort();
}

function shouldUseInteractiveInstall({
  stdinIsTTY,
  stdoutIsTTY,
  ci,
  plan,
  quiet,
  nonInteractive,
  machine,
}) {
  return Boolean(
    stdinIsTTY && stdoutIsTTY && !ci && !plan && !quiet && !nonInteractive && !machine,
  );
}

module.exports = {
  AGENT_TO_TARGETS,
  DEFAULT_USER_TARGETS,
  USER_TARGETS,
  defaultInstallConfig,
  desiredSkillsForPacks,
  installConfigPath,
  readInstallConfig,
  repositoryKey,
  serializeInstallConfig,
  shouldUseInteractiveInstall,
  writeInstallConfig,
};
