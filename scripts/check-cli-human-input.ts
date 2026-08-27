import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const forbidden = /\[(?:y|s)\/(?:N|n)\]|\[(?:personal|specs-shared|team)(?:\/[^\]]+)*\]/i;
const directQuestion = /\.question\s*\(/;
const allowlistedFiles = new Set(['selector.ts']);

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : file.endsWith('.ts') ? [file] : [];
  });
}

function main(): void {
  const findings: string[] = [];
  for (const file of sourceFiles(sourceRoot)) {
    const relative = path.relative(sourceRoot, file);
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (forbidden.test(line)) findings.push(`${relative}:${index + 1}: finite text prompt`);
      if (
        directQuestion.test(line) &&
        !allowlistedFiles.has(path.basename(file)) &&
        !content.includes('human-input-allowlist: free-form')
      )
        findings.push(`${relative}:${index + 1}: unclassified direct input`);
    });
  }
  if (findings.length) throw new Error(`human CLI input audit failed:\n${findings.join('\n')}`);
  process.stdout.write('PASS human CLI input audit\n');
}

main();
