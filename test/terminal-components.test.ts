import assert from 'node:assert/strict';
import test from 'node:test';
import { renderCard, renderGallery, renderJourney, renderStatus } from '../src/terminal-components';
import { resolvePresentationContext } from '../src/ui';

function context(mode: 'human-rich' | 'human-plain' | 'machine', width = 80, noColor = false) {
  const input = { isTTY: mode === 'human-rich', setRawMode: () => undefined } as never;
  const output = { isTTY: mode === 'human-rich', columns: width } as never;
  return resolvePresentationContext(
    { stdin: input, stdout: output },
    mode === 'human-rich' ? (noColor ? { NO_COLOR: '1' } : { COLORTERM: 'truecolor' }) : {},
    mode === 'machine' ? { machine: true } : mode === 'human-plain' ? { quiet: true } : {},
  );
}

test('terminal components keep semantic structure without color', () => {
  const rich = context('human-rich');
  const noColorContext = context('human-rich', 80, true);
  const plain = context('human-plain');
  assert.match(
    renderJourney(
      [
        { label: 'observe', state: 'completed' },
        { label: 'plan', state: 'active' },
      ],
      rich,
    ),
    /┌|└/,
  );
  assert.match(renderStatus('success', 'done', plain), /^OK done$/);
  assert.match(
    renderCard(
      'Plan',
      [{ key: 'Command', value: 'npx sdd-agentic-flow doctor --json', copyable: true }],
      noColorContext,
    ),
    /npx sdd-agentic-flow doctor --json/,
  );
  assert.doesNotMatch(renderJourney([{ label: 'observe', state: 'active' }], plain), /[◇◆○┌└]/);
  assert.match(renderJourney([{ label: 'observe', state: 'active' }], plain), /\*/);
  assert.equal(renderGallery(noColorContext).includes(String.fromCharCode(27)), false);
  assert.doesNotMatch(renderGallery(context('machine')), /Summary|observe/);
});

test('gallery is deterministic and preserves long copyable values', () => {
  const first = renderGallery(context('human-rich', 40));
  assert.equal(first, renderGallery(context('human-rich', 40)));
  assert.match(first, /npx sdd-agentic-flow doctor --json/);
  assert.doesNotMatch(
    renderCard(
      'Summary',
      [{ key: 'Command', value: 'npx sdd-agentic-flow doctor --json', copyable: true }],
      context('human-rich', 40),
    ),
    /\n│/,
  );
});
