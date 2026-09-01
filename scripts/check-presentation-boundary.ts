import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('src');
const presentationOwners = new Set([
  'brand-art.ts',
  'messages.ts',
  'selector.ts',
  'terminal-components.ts',
  'terminal-theme.ts',
  'terminal-ui.ts',
  'ui.ts',
]);
const glyphOwners = new Set(['brand-art.ts', 'messages.ts', 'terminal-theme.ts']);
const colorOwners = new Set([
  'brand-art.ts',
  'terminal-components.ts',
  'terminal-theme.ts',
  'terminal-ui.ts',
  'ui.ts',
]);
const approvedStructuralGlyphs = /[┌│├└─┐┘◇◆✓✗→←↑↓↳▸▹›●○■□]/;
const prohibitedPresentation =
  /(?:\uFE0E|\uFE0F|\u200D|[\uE000-\uF8FF]|[\u{F0000}-\u{FFFFD}]|[\u{100000}-\u{10FFFD}])/u;
const violations: string[] = [];

function visit(directory: string) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;

    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(process.cwd(), file);
    if (
      !presentationOwners.has(entry.name) &&
      /from ['"](?:@clack\/prompts|picocolors)['"]/.test(source)
    )
      violations.push(`${relative}: direct terminal adapter import`);
    if (!presentationOwners.has(entry.name) && /\\x1b\[/.test(source))
      violations.push(`${relative}: raw ANSI escape`);
    if (
      colorOwners.has(entry.name) &&
      entry.name !== 'terminal-theme.ts' &&
      /#[0-9A-Fa-f]{6}\b/.test(source)
    )
      violations.push(`${relative}: raw UI color outside terminal theme`);
    if (!glyphOwners.has(entry.name) && approvedStructuralGlyphs.test(source))
      violations.push(`${relative}: structural terminal glyph`);
    if (prohibitedPresentation.test(source))
      violations.push(`${relative}: prohibited emoji/variation/private-use presentation`);
  }
}

visit(root);
for (const file of ['terminal-theme.ts', 'brand-art.ts']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (prohibitedPresentation.test(source))
    violations.push(`src/${file}: prohibited emoji/variation/private-use presentation`);
}
if (violations.length) {
  console.error('FAIL presentation boundary:');
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}
console.log('PASS presentation boundary: terminal styling and glyphs stay in owned renderers');
