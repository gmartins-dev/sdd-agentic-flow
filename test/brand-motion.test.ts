import assert from 'node:assert/strict';
import test from 'node:test';
import { playBrandMotion } from '../src/brand-motion';
import { stripAnsi } from '../src/terminal-geometry';

test('motion redraws with explicit CRLF and skips stale frames', async () => {
  let now = 0;
  const chunks: string[] = [];
  const waits: number[] = [];
  await playBrandMotion(
    {
      isTTY: true,
      columns: 80,
      write: (chunk) => {
        chunks.push(chunk);
        return true;
      },
    },
    { NO_COLOR: '1' },
    {
      durationMs: 20,
      now: () => now,
      wait: async (ms) => {
        waits.push(ms);
        now += ms;
      },
    },
  );

  assert.deepEqual(waits, [10, 10]);
  assert.equal(chunks.length, 3);
  assert.match(chunks[0] ?? '', /\r\n/);
  assert.match(stripAnsi(chunks.at(-1) ?? ''), /█/);
});

test('motion waits for accepted backpressure before settling', async () => {
  const chunks: string[] = [];
  const events: string[] = [];
  await playBrandMotion(
    {
      isTTY: true,
      columns: 80,
      write: (chunk) => {
        chunks.push(chunk);
        return false;
      },
      once: (event, listener) => {
        events.push(event);
        if (event === 'drain') queueMicrotask(listener);
      },
    },
    { NO_COLOR: '1' },
    { durationMs: 0 },
  );

  assert.equal(chunks.length, 1);
  assert.deepEqual(events, ['drain', 'error', 'close']);
  assert.match(stripAnsi(chunks[0] ?? ''), /█/);
});

test('stream errors fall back to one final frame', async () => {
  const chunks: string[] = [];
  let first = true;
  await playBrandMotion(
    {
      isTTY: true,
      columns: 80,
      write: (chunk) => {
        chunks.push(chunk);
        if (first) {
          first = false;
          return false;
        }
        return true;
      },
      once: (event, listener) => {
        if (event === 'error') queueMicrotask(listener);
      },
    },
    { NO_COLOR: '1' },
    { durationMs: 0 },
  );

  assert.equal(chunks.length, 2);
  assert.match(stripAnsi(chunks.at(-1) ?? ''), /█/);
});
