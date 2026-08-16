import type { BrandStream } from '../src/brand-art';

export function brandStream(isTTY: boolean, columns = 80): BrandStream {
  return {
    isTTY,
    columns,
    write: () => true,
  };
}

export function outputStreams(stdoutTTY: boolean, stdinTTY: boolean) {
  return {
    stdout: brandStream(stdoutTTY),
    stdin: brandStream(stdinTTY),
  };
}

export function asBrandStream(partial: {
  isTTY?: boolean;
  columns?: number;
  rows?: number;
}): BrandStream {
  return {
    write: () => true,
    ...partial,
  };
}
