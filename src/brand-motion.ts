import { performance } from 'node:perf_hooks';
import {
  CANONICAL_BRAND_HEIGHT,
  CANONICAL_BRAND_WIDTH,
  BRAND_ANIMATION as GENERATED_BRAND_ANIMATION,
} from './brand-animation.generated';
import { ansiColor, COLORS } from './terminal-theme';

export type BrandMotionRole =
  | 'brand.small'
  | 'brand.medium'
  | 'brand.large'
  | 'flow.dim'
  | 'flow.energy'
  | 'flow.highlight';
export type BrandRun = { column: number; text: string; role: BrandMotionRole };
export type BrandFrame = { durationMs: number; rows: readonly (readonly BrandRun[])[] };
export type BrandAnimation = { width: 80; height: 34; frames: readonly BrandFrame[] };
export type MotionStream = {
  isTTY?: boolean;
  columns?: number;
  write: (chunk: string) => boolean | undefined;
  once?: (event: string, listener: (...args: unknown[]) => void) => void;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

const COLORS_BY_ROLE = {
  'brand.small': COLORS.brand.secondary,
  'brand.medium': COLORS.brand.primary,
  'brand.large': COLORS.brand.accent,
  'flow.dim': COLORS.structure.subtle,
  'flow.energy': COLORS.interactive.active,
  'flow.highlight': COLORS.brand.accent,
};
export const BRAND_ANIMATION: BrandAnimation = GENERATED_BRAND_ANIMATION as BrandAnimation;

function color(role: BrandMotionRole, env: NodeJS.ProcessEnv, enabled: boolean) {
  if (!enabled || env.NO_COLOR !== undefined) return '';
  const value = COLORS_BY_ROLE[role];
  const terminal = env.TERM ?? '';
  const colorterm = env.COLORTERM ?? '';
  const depth =
    colorterm === 'truecolor' || colorterm === '24bit'
      ? 'truecolor'
      : terminal.includes('256color')
        ? 'ansi256'
        : 'ansi16';
  return `\x1b[${ansiColor(value, depth)}m`;
}

export function renderBrandFrame(
  frame: BrandFrame,
  columns: number = CANONICAL_BRAND_WIDTH,
  env: NodeJS.ProcessEnv = process.env,
  colored = true,
  center = false,
): string {
  const offset = center ? Math.max(0, Math.floor((columns - CANONICAL_BRAND_WIDTH) / 2)) : 0;
  return (
    frame.rows
      .map((runs) => {
        let line = ' '.repeat(offset);
        for (const run of runs)
          line += `${color(run.role, env, colored)}${run.text}${colored && env.NO_COLOR === undefined ? '\x1b[0m' : ''}`;
        return `${line}\x1b[K`;
      })
      .join('\r\n') + '\r\n'
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
function writeWithDrain(
  stream: MotionStream,
  chunk: string,
  deadline: number,
  now: () => number,
): Promise<void> {
  const accepted = stream.write(chunk);
  if (accepted !== false || !stream.once) return Promise.resolve();
  const remaining = Math.max(0, deadline - now());
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const listeners: Array<[string, (...args: unknown[]) => void]> = [];
    const remove = (event: string, listener: (...args: unknown[]) => void) => {
      stream.off?.(event, listener);
      stream.removeListener?.(event, listener);
    };
    const cleanup = () => {
      if (timer) clearTimeout(timer);
      for (const [event, listener] of listeners) remove(event, listener);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('brand motion stream closed during backpressure'));
    };
    listeners.push(['drain', finish], ['error', fail], ['close', fail]);
    stream.once?.('drain', finish);
    stream.once?.('error', fail);
    stream.once?.('close', fail);
    timer = setTimeout(finish, remaining);
  });
}

export async function playBrandMotion(
  stream: MotionStream,
  env: NodeJS.ProcessEnv = process.env,
  options: {
    center?: boolean;
    durationMs?: number;
    now?: () => number;
    wait?: (ms: number) => Promise<void>;
  } = {},
): Promise<void> {
  const now = options.now ?? (() => performance.now());
  const pause = options.wait ?? wait;
  const start = now();
  const total = options.durationMs ?? 590;
  const animation = BRAND_ANIMATION;
  const finalFrame = animation.frames[animation.frames.length - 1];
  if (!finalFrame) return;
  let rendered = -1;
  try {
    while (rendered < animation.frames.length - 1) {
      const elapsed = now() - start;
      const wanted =
        elapsed >= total
          ? animation.frames.length - 1
          : animation.frames.slice(0, -1).reduce((index, _frame, i) => {
              const deadline = animation.frames
                .slice(0, i)
                .reduce((sum, item) => sum + item.durationMs, 0);
              return elapsed >= deadline ? i : index;
            }, 0);
      if (wanted > rendered) {
        if (rendered >= 0)
          await writeWithDrain(stream, `\x1b[${CANONICAL_BRAND_HEIGHT}A`, start + total, now);
        await writeWithDrain(
          stream,
          renderBrandFrame(
            animation.frames[wanted] ?? finalFrame,
            stream.columns ?? CANONICAL_BRAND_WIDTH,
            env,
            stream.isTTY === true,
            Boolean(options.center),
          ),
          start + total,
          now,
        );
        rendered = wanted;
      }
      if (rendered < animation.frames.length - 1)
        await pause(Math.min(10, Math.max(1, total - (now() - start))));
    }
    if (rendered < animation.frames.length - 1)
      await writeWithDrain(
        stream,
        renderBrandFrame(
          finalFrame,
          stream.columns ?? CANONICAL_BRAND_WIDTH,
          env,
          stream.isTTY === true,
          Boolean(options.center),
        ),
        start + total + 20,
        now,
      );
  } catch {
    try {
      await writeWithDrain(
        stream,
        renderBrandFrame(
          finalFrame,
          stream.columns ?? CANONICAL_BRAND_WIDTH,
          env,
          stream.isTTY === true,
          Boolean(options.center),
        ),
        start + total + 20,
        now,
      );
    } catch {
      /* presentation is best effort */
    }
  }
}
