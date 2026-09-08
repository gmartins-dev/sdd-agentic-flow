import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

type LitmusCase = {
  id: string;
  counterexampleIdentified: boolean;
  survivedApplicableSensors: boolean;
  expectedDisposition: 'sensor-gap' | 'limitation';
};

function assessLitmusCase(input: LitmusCase): LitmusCase['expectedDisposition'] {
  if (input.counterexampleIdentified && input.survivedApplicableSensors) return 'sensor-gap';
  if (!input.counterexampleIdentified) return 'limitation';
  throw new Error(`fixture ${input.id} does not describe a supported litmus outcome`);
}

const fixture = path.join(__dirname, 'fixtures', 'v7.12.0', 'evidence-litmus.json');
const cases = JSON.parse(fs.readFileSync(fixture, 'utf8')) as LitmusCase[];

test('evidence litmus distinguishes surviving gaps from unlocated counterexamples', () => {
  assert.deepEqual(
    cases.map((input) => ({ id: input.id, disposition: assessLitmusCase(input) })),
    [
      { id: 'surviving-counterexample', disposition: 'sensor-gap' },
      { id: 'no-counterexample-identified', disposition: 'limitation' },
    ],
  );
});
