import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { writeFileAtomic } from '../src/atomic-write';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'saf-atomic-write-'));
}

test('writeFileAtomic creates parents and replaces the whole file without leaving a temporary', () => {
  const root = tempDir();
  const file = path.join(root, 'nested', 'config.yml');
  writeFileAtomic(file, 'first: long original content\n');
  writeFileAtomic(file, 'second\n');
  assert.equal(fs.readFileSync(file, 'utf8'), 'second\n');
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['config.yml']);
});

test('writeFileAtomic keeps the previous content and removes the temporary when rename fails', () => {
  const root = tempDir();
  const file = path.join(root, 'target');
  fs.mkdirSync(file);
  fs.writeFileSync(path.join(file, 'keep'), 'x');
  assert.throws(() => writeFileAtomic(file, 'replacement'));
  assert.equal(fs.readFileSync(path.join(file, 'keep'), 'utf8'), 'x');
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});
