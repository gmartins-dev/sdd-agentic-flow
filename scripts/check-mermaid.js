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
// GitHub Actions' ubuntu-latest disables unprivileged user namespaces (AppArmor), which
// Chromium's sandbox needs — Puppeteer fails to launch with "No usable sandbox!" otherwise.
// Safe here: this only renders trusted, repo-local Markdown to catch mermaid syntax errors,
// never untrusted content, and never runs as part of the distributed CLI.
const puppeteerConfigPath = path.join(__dirname, 'mermaid-puppeteer-config.json');

function resolveChromeExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates =
    process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : process.platform === 'win32'
        ? [
            `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
          ];
  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
}

function puppeteerConfigFile() {
  const base = JSON.parse(fs.readFileSync(puppeteerConfigPath, 'utf8'));
  const executablePath = resolveChromeExecutable();
  if (!executablePath) {
    return puppeteerConfigPath;
  }
  const merged = { ...base, executablePath };
  const tempPath = path.join(os.tmpdir(), `sdd-agentic-flow-mermaid-puppeteer-${process.pid}.json`);
  fs.writeFileSync(tempPath, `${JSON.stringify(merged, null, 2)}\n`);
  return tempPath;
}

function trackedMarkdownFiles() {
  const output = execFileSync('git', ['ls-files', '*.md', ':!.specs/**'], {
    cwd: root,
    encoding: 'utf8',
  });
  return output
    .split('\n')
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(root, file)));
}

function hasMermaidBlock(file) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  return /```mermaid\b/.test(content);
}

function isTransientLaunchError(message) {
  return /Timed out after \d+ ms while waiting for the WS endpoint|No usable sandbox|Target closed|Protocol error/i.test(
    message,
  );
}

function renderMermaid(file, tempDir, puppeteerConfig, attempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      execFileSync(
        mmdc,
        [
          '-i',
          path.join(root, file),
          '-o',
          path.join(tempDir, `out-${attempt}.svg`),
          '-q',
          '-p',
          puppeteerConfig,
        ],
        // Windows can't spawn a `.cmd` shim directly without a shell (EINVAL) since Node's
        // CVE-2024-27980 hardening; POSIX doesn't need it, so scope to win32 only.
        { stdio: 'pipe', shell: process.platform === 'win32' },
      );
      return;
    } catch (error) {
      lastError = error;
      const message = error.stderr?.toString() || error.message || '';
      if (!isTransientLaunchError(message) || attempt === attempts) throw error;
      // Brief backoff before relaunching Chromium on CI flakes (esp. Node 26 runners).
      const until = Date.now() + 500 * attempt;
      while (Date.now() < until) {
        /* spin */
      }
    }
  }
  throw lastError;
}

function main() {
  const files = trackedMarkdownFiles().filter(hasMermaidBlock);
  if (!files.length) {
    console.log('PASS no mermaid blocks found');
    return;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdd-agentic-flow-mermaid-'));
  const puppeteerConfig = puppeteerConfigFile();
  const failures = [];
  try {
    for (const file of files) {
      try {
        renderMermaid(file, tempDir, puppeteerConfig);
        console.log(`PASS ${file}`);
      } catch (error) {
        failures.push({ file, message: error.stderr?.toString() || error.message });
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (puppeteerConfig !== puppeteerConfigPath) {
      fs.rmSync(puppeteerConfig, { force: true });
    }
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
