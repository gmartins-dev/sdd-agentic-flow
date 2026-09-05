import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export type PtyStep = {
  waitFor: RegExp;
  input: string;
  timeoutMs?: number;
};

export type PtyResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  transcript: string;
  stderr: string;
};

const DEFAULT_STEP_TIMEOUT_MS = 20_000;
const DEFAULT_SCENARIO_TIMEOUT_MS = 60_000;
const TERMINATION_GRACE_MS = 250;

export function hasScriptPty(): boolean {
  if (process.platform !== 'linux') return false;
  const probe = spawnSync('script', ['-qec', 'true', '/dev/null'], { encoding: 'utf8' });
  return !probe.error && probe.status === 0;
}

function assertStatelessMatcher(matcher: RegExp): void {
  if (matcher.global || matcher.sticky)
    throw new TypeError('PTY prompt matchers must not use global or sticky state');
}

function waitForOutput(
  processRef: ChildProcess,
  transcript: () => string,
  matcher: RegExp,
  timeoutMs: number,
  offset: number,
): Promise<number> {
  assertStatelessMatcher(matcher);
  return new Promise<number>((resolve, reject) => {
    let settled = false;
    const matchEnd = () => {
      const match = transcript().slice(offset).match(matcher);
      return match?.index === undefined ? null : offset + match.index + match[0].length;
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      processRef.stdout?.off('data', onData);
      processRef.off('close', onClose);
      processRef.off('error', onError);
      callback();
    };
    const initialMatchEnd = matchEnd();
    if (initialMatchEnd !== null) {
      resolve(initialMatchEnd);
      return;
    }
    const onData = () => {
      const end = matchEnd();
      if (end === null) return;
      finish(() => resolve(end));
    };
    const onClose = () => {
      finish(() => reject(new Error(`PTY process closed before ${matcher}`)));
    };
    const onError = (error: Error) => {
      finish(() => reject(new Error(`PTY process error before ${matcher}: ${error.message}`)));
    };
    const timer = setTimeout(
      () => {
        finish(() => reject(new Error(`PTY prompt timeout for ${matcher}`)));
      },
      Math.max(1, timeoutMs),
    );
    processRef.stdout?.on('data', onData);
    processRef.once('close', onClose);
    processRef.once('error', onError);
  });
}

function signalProcessTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid && process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to the wrapper process when a process group is unavailable.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The process may have exited between the state check and the signal.
  }
}

async function terminateAndReap(
  child: ChildProcess,
  closePromise: Promise<PtyResult>,
  isClosed: () => boolean,
): Promise<PtyResult> {
  if (isClosed()) return closePromise;
  child.stdin?.end();
  signalProcessTree(child, 'SIGTERM');
  await Promise.race([
    closePromise,
    new Promise((resolve) => setTimeout(resolve, TERMINATION_GRACE_MS)),
  ]);
  if (!isClosed()) signalProcessTree(child, 'SIGKILL');
  return closePromise;
}

export async function runScriptPty(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; steps: readonly PtyStep[]; timeoutMs?: number },
): Promise<PtyResult> {
  if (!hasScriptPty()) throw new Error('script PTY wrapper is unavailable on this host');
  for (const step of options.steps) assertStatelessMatcher(step.waitFor);
  const scenarioDeadline = performance.now() + (options.timeoutMs ?? DEFAULT_SCENARIO_TIMEOUT_MS);
  const child = spawn('script', ['-qec', command, '/dev/null'], {
    cwd: options.cwd,
    env: options.env,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let transcript = '';
  let stderr = '';
  let closed = false;
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    transcript += chunk;
  });
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk;
  });
  const closePromise = new Promise<PtyResult>((resolve) => {
    child.once('error', () => {
      // The close event remains the single lifecycle completion signal.
    });
    child.once('close', (status, signal) => {
      closed = true;
      resolve({ status, signal, transcript, stderr });
    });
  });
  let cursor = 0;
  try {
    for (const step of options.steps) {
      const remaining = Math.min(
        step.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
        Math.max(1, scenarioDeadline - performance.now()),
      );
      cursor = await waitForOutput(child, () => transcript, step.waitFor, remaining, cursor);
      if (step.input) child.stdin?.write(step.input);
    }
    const remaining = scenarioDeadline - performance.now();
    if (remaining <= 0) {
      const result = await terminateAndReap(child, closePromise, () => closed);
      return { ...result, status: result.status ?? null, signal: result.signal ?? 'SIGTERM' };
    }
    return await new Promise<PtyResult>((resolve, reject) => {
      const timer = setTimeout(async () => {
        try {
          const result = await terminateAndReap(child, closePromise, () => closed);
          resolve({ ...result, status: result.status ?? null, signal: result.signal ?? 'SIGTERM' });
        } catch (error) {
          reject(error);
        }
      }, remaining);
      closePromise.then((result) => {
        clearTimeout(timer);
        resolve(result);
      }, reject);
    });
  } catch (error) {
    const result = await terminateAndReap(child, closePromise, () => closed);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}\nstatus=${result.status ?? 'unknown'} signal=${result.signal ?? 'unknown'}\nwrapper stderr: ${stderr}\ntranscript tail: ${transcript.slice(-4000)}`,
    );
  }
}
