import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderCard,
  renderGallery,
  renderJourney,
  renderStatus,
  renderWelcomeText,
} from '../src/terminal-components';
import { displayWidth } from '../src/terminal-geometry';
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
  const esc = String.fromCharCode(27);
  assert.match(renderGallery(noColorContext), new RegExp(`${esc}\\[1m`));
  assert.doesNotMatch(renderGallery(noColorContext), /38(?:;|m)/);
  assert.doesNotMatch(renderGallery(context('machine')), /Summary|observe/);
});

test('welcome text centers rich lines and keeps the localized tagline italic', () => {
  const rich = renderWelcomeText(context('human-rich', 80), 'en-US');
  const noColor = renderWelcomeText(context('human-rich', 80, true), 'pt-BR');
  assert.match(rich, /SDD-AGENTIC-FLOW \(SAF\)/);
  const esc = String.fromCharCode(27);
  assert.match(rich, new RegExp(`${esc}\\[.*1m`));
  assert.match(rich, new RegExp(`${esc}\\[.*3m`));
  assert.match(noColor, /Specs primeiro\. Evidências antes de concluir\. Você mantém o controle\./);
  assert.match(noColor, new RegExp(`${esc}\\[3m`));
  assert.doesNotMatch(noColor, /38(?:;|m)/);
  for (const line of rich.split('\n').filter(Boolean)) {
    assert.ok(displayWidth(line) <= 80);
  }
});

test('gallery is deterministic and keeps card content inside the terminal box', () => {
  const first = renderGallery(context('human-rich', 40));
  assert.equal(first, renderGallery(context('human-rich', 40)));
  const card = renderCard(
    'Pronto para configurar o SAF',
    [
      {
        key: 'Operações de arquivo',
        value: 'persistir os destinos e o compartilhamento selecionados',
      },
      { key: 'Command', value: 'npx sdd-agentic-flow doctor --json', copyable: true },
    ],
    context('human-rich', 40, true),
  );
  assert.match(card, /npx sdd-agentic-flow/);
  assert.match(card, /doctor --json/);
  for (const line of card.split('\n')) assert.ok(displayWidth(line) <= 40, line);
  const cardLines = card.split('\n');
  assert.ok(cardLines.slice(1, -1).every((line) => line.startsWith('│') && line.endsWith('│')));
});
