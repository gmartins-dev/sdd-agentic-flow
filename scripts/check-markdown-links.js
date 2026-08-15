#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'markdown-link-check.cmd' : 'markdown-link-check',
);
const files = execFileSync('git', ['ls-files', '*.md', ':!.specs/**'], {
  cwd: root,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => fs.existsSync(path.join(root, file)));

if (files.length) {
  execFileSync(cli, ['-c', '.markdown-link-check.json', ...files], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
