import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const packageRoot = path.resolve(__dirname, '..');
const compiler = path.resolve(path.dirname(require.resolve('typescript')), '..', 'bin', 'tsc');

function runCompiler(project: string): { status: number; output: string } {
  try {
    execFileSync(process.execPath, [compiler, '-p', project, '--noEmit'], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { status: 0, output: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? 1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
}

test('published source boundary rejects maintainer imports but broad typecheck permits them', () => {
  const suffix = `${process.pid}`;
  const sourceProbe = path.join(packageRoot, 'src', `source-boundary-probe-${suffix}.ts`);
  const maintainerProbe = path.join(packageRoot, 'scripts', `source-boundary-probe-${suffix}.ts`);
  assert.equal(fs.existsSync(sourceProbe), false);
  assert.equal(fs.existsSync(maintainerProbe), false);

  try {
    fs.writeFileSync(sourceProbe, "import './paths.js';\n");
    fs.writeFileSync(maintainerProbe, 'export const sourceBoundaryProbe = true;\n');

    assert.deepEqual(runCompiler('tsconfig.build.json'), { status: 0, output: '' });

    fs.writeFileSync(
      sourceProbe,
      `export { sourceBoundaryProbe } from '../scripts/${path.basename(maintainerProbe, '.ts')}.js';\n`,
    );
    const buildResult = runCompiler('tsconfig.build.json');
    assert.notEqual(buildResult.status, 0);
    assert.match(buildResult.output, /TS6059/);
    assert.match(buildResult.output, new RegExp(path.basename(maintainerProbe)));

    assert.deepEqual(runCompiler('tsconfig.json'), { status: 0, output: '' });
  } finally {
    fs.rmSync(sourceProbe, { force: true });
    fs.rmSync(maintainerProbe, { force: true });
  }
});
