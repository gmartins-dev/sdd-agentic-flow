import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const workflowsDir = path.resolve(__dirname, '..', '.github', 'workflows');
const workflowFiles = fs.readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name));
const read = (name: string) => fs.readFileSync(path.join(workflowsDir, name), 'utf8');

// Shell bodies of `run:` steps, single-line or block scalar, without their YAML indentation.
function runBodies(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const bodies: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index]?.match(/^(\s*)(?:- )?run:\s*(.*)$/);
    if (!match) continue;
    const indent = match[1]?.length ?? 0;
    const inline = match[2] ?? '';
    if (inline && inline !== '|' && inline !== '>') {
      bodies.push(inline);
      continue;
    }
    const block: string[] = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1] ?? '';
      const nextIndent = next.match(/^\s*/)?.[0].length ?? 0;
      if (next.trim() && nextIndent <= indent) break;
      block.push(next);
      index += 1;
    }
    bodies.push(block.join('\n'));
  }
  return bodies;
}

test('every GitHub Action reference is pinned to a full commit SHA', () => {
  for (const name of workflowFiles) {
    for (const line of read(name).split(/\r?\n/)) {
      const match = line.match(/^\s*(?:- )?uses:\s*(\S+)/);
      if (!match?.[1] || match[1].startsWith('./')) continue;
      assert.match(match[1], /@[0-9a-f]{40}$/, `${name}: ${match[1]} is not SHA-pinned`);
    }
  }
});

test('release runs only for a push to this repository and never executes dependency scripts', () => {
  const release = read('release.yml');
  assert.match(release, /github\.event\.workflow_run\.event == 'push'/);
  assert.match(
    release,
    /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/,
  );
  assert.match(release, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(release, /^concurrency:/m);
  for (const line of release.split(/\r?\n/).filter((entry) => /\bnpm ci\b/.test(entry)))
    assert.match(line, /--ignore-scripts/, `release install must ignore scripts: ${line.trim()}`);
  assert.doesNotMatch(release, /@latest\b/);
});

test('release shell steps receive expressions through env instead of inline interpolation', () => {
  for (const body of runBodies(read('release.yml')))
    assert.doesNotMatch(body, /\$\{\{/, `inline expression in release run step:\n${body}`);
});
