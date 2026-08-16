import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  normalizeLocale,
  resolveLocale,
  t,
  translateText,
  validateCatalogParity,
} from '../src/messages';

test('message catalogs keep parity and locale resolution is deterministic', () => {
  assert.equal(validateCatalogParity(), true);
  assert.equal(normalizeLocale('pt_BR'), 'pt-BR');
  assert.equal(resolveLocale({ explicit: 'br', configured: 'en-US' }), 'pt-BR');
  assert.equal(resolveLocale({ configured: 'pt-BR' }), 'pt-BR');
  assert.equal(resolveLocale({}), 'en-US');
  assert.equal(t('pt-BR', 'ready.title'), 'Pronto');
  assert.equal(t('en-US', 'menu.more'), 'Commands and advanced options');
  assert.equal(t('pt-BR', 'menu.more'), 'Comandos e opções avançadas');
  assert.equal(t('pt-BR', 'setup.recommended'), 'Configuração recomendada');
  assert.equal(t('pt-BR', 'menu.changePolicy'), 'Alterar política operacional');
  assert.equal(t('en-US', 'menu.changeInstall'), 'Change installation setup');
  assert.equal(t('en-US', 'setup.policySupervised'), 'Supervised — recommended');
  assert.equal(t('pt-BR', 'doctor.next'), 'Próxima etapa');
  assert.equal(t('en-US', 'unknown.key'), 'unknown.key');
  assert.equal(translateText('pt-BR', 'No changes were made.'), 'Nenhuma alteração foi feita.');
  assert.equal(translateText('en-US', 'No changes were made.'), 'No changes were made.');
});
