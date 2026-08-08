#!/usr/bin/env node
'use strict';

// Milestone 8: mermaid-as-convention validation. Renders every ```mermaid block in docs/**/*.md
// and README*.md through `mmdc` (the @mermaid-js/mermaid-cli devDependency) to catch syntax
// errors — a documentation-tooling check, never a runtime capability of the distributed CLI
// (see docs/environment-compatibility.md and the package_integrity doctor check, which both
// keep `dependencies` empty; `@mermaid-js/mermaid-cli` only ever appears in `devDependencies`).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const mmdc = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc',
);

function trackedMarkdownFiles() {
  const output = execFileSync('git', ['ls-files', '*.md', ':!.specs/**'], {
    cwd: root,
    encoding: 'utf8',
  });
  return output.split('\n').filter(Boolean);
}

function hasMermaidBlock(file) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  return /```mermaid\b/.test(content);
}

function main() {
  const files = trackedMarkdownFiles().filter(hasMermaidBlock);
  if (!files.length) {
    console.log('PASS no mermaid blocks found');
    return;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-mermaid-'));
  const failures = [];
  try {
    for (const file of files) {
      try {
        execFileSync(
          mmdc,
          ['-i', path.join(root, file), '-o', path.join(tempDir, 'out.svg'), '-q'],
          { stdio: 'pipe' },
        );
        console.log(`PASS ${file}`);
      } catch (error) {
        failures.push({ file, message: error.stderr?.toString() || error.message });
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  if (failures.length) {
    for (const failure of failures) {
      console.error(`FAIL ${failure.file}`);
      console.error(failure.message);
    }
    process.exit(1);
  }
  console.log(`PASS ${files.length} file(s) with mermaid blocks validated`);
}

main();
