import { type ChildProcess, spawn, spawnSync } from 'node:child_process';

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

export function hasScriptPty(): boolean {
  if (process.platform !== 'linux') return false;
  const probe = spawnSync('script', ['-qec', 'true', '/dev/null'], { encoding: 'utf8' });
  return !probe.error && probe.status === 0;
}

function waitForOutput(
  processRef: ChildProcess,
  transcript: () => string,
  matcher: RegExp,
  timeoutMs: number,
) {
  return new Promise<void>((resolve, reject) => {
    if (matcher.test(transcript())) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`PTY prompt timeout for ${matcher}:\n${transcript()}`));
    }, timeoutMs);
    const onData = () => {
      if (!matcher.test(transcript())) return;
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error(`PTY process closed before ${matcher}:\n${transcript()}`));
    };
    const cleanup = () => {
      clearTimeout(timer);
      processRef.stdout?.off('data', onData);
      processRef.off('close', onClose);
    };
    processRef.stdout?.on('data', onData);
    processRef.once('close', onClose);
  });
}

export async function runScriptPty(
  command: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; steps: readonly PtyStep[]; timeoutMs?: number },
): Promise<PtyResult> {
  if (!hasScriptPty()) throw new Error('script PTY wrapper is unavailable on this host');
  const child = spawn('script', ['-qec', command, '/dev/null'], {
    cwd: options.cwd,
    env: options.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let transcript = '';
  let stderr = '';
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    transcript += chunk;
  });
  child.stderr?.on('data', (chunk: string) => {
    stderr += chunk;
  });
  for (const step of options.steps) {
    await waitForOutput(child, () => transcript, step.waitFor, step.timeoutMs ?? 10_000);
    child.stdin?.write(step.input);
  }
  const result = await new Promise<PtyResult>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ status: null, signal: 'SIGTERM', transcript, stderr });
    }, options.timeoutMs ?? 30_000);
    child.once('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, transcript, stderr });
    });
  });
  return result;
}
