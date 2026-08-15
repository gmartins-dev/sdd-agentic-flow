'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  normalizeLocale,
  resolveLocale,
  t,
  translateText,
  validateCatalogParity,
} = require('../bin/messages');

test('message catalogs keep parity and locale resolution is deterministic', () => {
  assert.equal(validateCatalogParity(), true);
  assert.equal(normalizeLocale('pt_BR'), 'pt-BR');
  assert.equal(resolveLocale({ explicit: 'br', configured: 'en-US' }), 'pt-BR');
  assert.equal(resolveLocale({ configured: 'pt-BR' }), 'pt-BR');
  assert.equal(resolveLocale({}), 'en-US');
  assert.equal(t('pt-BR', 'ready.title'), 'Pronto');
  assert.equal(t('en-US', 'unknown.key'), 'unknown.key');
  assert.equal(translateText('pt-BR', 'No changes were made.'), 'Nenhuma alteração foi feita.');
  assert.equal(translateText('en-US', 'No changes were made.'), 'No changes were made.');
});
