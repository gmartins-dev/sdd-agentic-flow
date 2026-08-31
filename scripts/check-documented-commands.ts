import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

import { CANONICAL_COMMANDS } from '../src/command-registry';

const documentedFiles = execFileSync('git', ['ls-files', '*.md', ':!.specs/**'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean)
  .filter((file) => file === 'README.md' || file === 'README.pt-BR.md' || file.startsWith('docs/'));

const topLevelCommands = new Set(CANONICAL_COMMANDS.map((command) => command.split(' ')[0]));
const cited = new Set<string>();

for (const file of documentedFiles) {
  const content = fs.readFileSync(file, 'utf8');
  for (const match of content.matchAll(/npx sdd-agentic-flow ([a-zA-Z][a-zA-Z0-9_-]*)/g)) {
    if (match[1]) cited.add(match[1]);
  }
}

const missing = [...cited].filter((command) => !topLevelCommands.has(command));
if (missing.length) {
  console.error(
    `documented command(s) not found in source command registry: ${missing.join(', ')}`,
  );
  process.exit(1);
}

console.log(`all ${cited.size} documented command(s) exist in the source command registry`);
