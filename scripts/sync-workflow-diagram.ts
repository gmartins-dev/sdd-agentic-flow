// Keeps README workflow mermaid blocks in sync with shared/templates/workflow-diagram.mmd.
// @ts-nocheck
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'shared', 'templates', 'workflow-diagram.mmd');
const targets = ['README.md', 'README.pt-BR.md'].map((file) => path.join(root, file));
const checkOnly = process.argv.includes('--check');

const diagram = fs.readFileSync(sourcePath, 'utf8').trimEnd();
const replacement = `\`\`\`mermaid\n${diagram}\n\`\`\``;
const pattern = /```mermaid\n[\s\S]*?```/;

function syncTarget(targetPath) {
  const content = fs.readFileSync(targetPath, 'utf8');
  if (!pattern.test(content)) {
    console.error(`FAIL ${path.relative(root, targetPath)}: no mermaid block found`);
    process.exitCode = 1;
    return;
  }
  const next = content.replace(pattern, replacement);
  if (next === content) {
    console.log(`PASS ${path.relative(root, targetPath)} already synced`);
    return;
  }
  if (checkOnly) {
    console.error(`FAIL ${path.relative(root, targetPath)}: out of sync with workflow-diagram.mmd`);
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(targetPath, next, 'utf8');
  console.log(`PASS synced ${path.relative(root, targetPath)}`);
}

for (const target of targets) syncTarget(target);
if (process.exitCode) process.exit(process.exitCode);
