import fs from 'node:fs';
import path from 'node:path';
import { BRAND_ANIMATION, renderBrandFrame } from '../src/brand-motion';

const ROOT = process.cwd();
const SVG_PATH = path.join(ROOT, 'public/imgs/symbol.svg');
const TXT_PATH = path.join(ROOT, 'public/ascii/saf-ascii-art.txt');
const GENERATED_PATH = path.join(ROOT, 'src/brand-animation.generated.ts');
const SVG_WIDTH = 114;
const SVG_HEIGHT = 96;
export const WIDTH = 80;
const CELL_HEIGHT_RATIO = 0.5;
export const HEIGHT = Math.round(((SVG_HEIGHT * WIDTH) / SVG_WIDTH) * CELL_HEIGHT_RATIO);
const ROLES = ['small', 'medium', 'large'] as const;
const DURATIONS = [50, 55, 60, 65, 65, 70, 70, 75, 80, 0] as const;
type Role = (typeof ROLES)[number];
type Triangle = { role: Role; points: readonly [number, number][] };
type Cell = { role: Role };

function parseSvg(): Triangle[] {
  const svg = fs.readFileSync(SVG_PATH, 'utf8');
  const viewBox = svg
    .match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);
  if (
    !viewBox ||
    viewBox.length !== 4 ||
    viewBox.some((n) => !Number.isFinite(n)) ||
    viewBox[0] !== 0 ||
    viewBox[1] !== 0 ||
    viewBox[2] !== SVG_WIDTH ||
    viewBox[3] !== SVG_HEIGHT
  ) {
    throw new Error('Unsupported symbol.svg viewBox');
  }
  const transform = svg.match(
    /<g\b[^>]*transform\s*=\s*["']translate\(([-\d.]+),\s*([-\d.]+)\)\s*scale\(([-\d.]+)\)["']/,
  );
  if (!transform) throw new Error('Unsupported symbol.svg group transform');
  const tx = Number(transform[1]);
  const ty = Number(transform[2]);
  const scale = Number(transform[3]);
  const polygons = [...svg.matchAll(/<polygon\b([^>]*)>(?:<\/polygon>)?/g)];
  if (polygons.length !== 3) throw new Error('symbol.svg must contain exactly three polygons');
  return polygons.map((match, index) => {
    const pointsText = match[1]?.match(/points\s*=\s*["']([^"']+)["']/)?.[1];
    const fill = match[1]?.match(/fill\s*=\s*["']([^"']+)["']/)?.[1]?.toUpperCase();
    const points = pointsText
      ?.trim()
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number));
    if (
      !points ||
      points.length !== 3 ||
      points.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))
    ) {
      throw new Error('symbol.svg polygons must be triangles');
    }
    const expected = ['#4B3EA8', '#6D5EF0', '#8B7DFF'][index];
    const role = ROLES[index];
    if (!role || fill !== expected) throw new Error(`Unexpected fill for ${role ?? 'unknown'}`);
    return {
      role,
      points: points.map((pair) => {
        const x = pair[0] ?? 0;
        const y = pair[1] ?? 0;
        return [x * scale + tx, y * scale + ty] as [number, number];
      }),
    };
  });
}

function insideTriangle(x: number, y: number, triangle: Triangle): boolean {
  const [a, b, c] = triangle.points;
  if (!a || !b || !c) return false;
  const sign = (
    p1: readonly [number, number],
    p2: readonly [number, number],
    p3: readonly [number, number],
  ) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = sign([x, y], a, b);
  const d2 = sign([x, y], b, c);
  const d3 = sign([x, y], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

function rasterize(): Cell[][] {
  const triangles = parseSvg();
  const cells: Cell[][] = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    const row: Cell[] = [];
    for (let x = 0; x < WIDTH; x += 1) {
      const sx = ((x + 0.5) * SVG_WIDTH) / WIDTH;
      const sy = ((y + 0.5) * SVG_HEIGHT) / HEIGHT;
      const hits = triangles.filter((triangle) => insideTriangle(sx, sy, triangle));
      if (hits.length > 1) throw new Error(`Overlapping raster cell ${x},${y}`);
      row.push(hits[0] ? { role: hits[0].role } : { role: undefined as never });
    }
    cells.push(row);
  }
  for (const role of ROLES) {
    if (!cells.some((row) => row.some((cell) => cell.role === role)))
      throw new Error(`No raster coverage for ${role}`);
  }
  return cells;
}

function txt(cells: Cell[][]): string {
  return `${cells.map((row) => row.map((cell) => (cell.role ? '█' : ' ')).join('')).join('\n')}\n`;
}

function runs(cells: Cell[][]): string {
  const rows = cells.map((row) => {
    const result: string[] = [];
    let start = -1;
    let role: Role | undefined;
    for (let x = 0; x <= row.length; x += 1) {
      const next = row[x]?.role;
      if (next === role && next !== undefined) continue;
      if (role !== undefined) result.push(`[${start}, ${x - 1}, '${role}']`);
      start = next === undefined ? -1 : x;
      role = next;
    }
    return `[${result.join(', ')}]`;
  });
  return `import type { BrandMotionRole } from './brand-motion';\n\nexport const CANONICAL_BRAND_WIDTH = ${WIDTH} as const;\nexport const CANONICAL_BRAND_HEIGHT = ${HEIGHT} as const;\nexport const CANONICAL_BRAND_MASK = [\n${rows.map((row) => `  ${row},`).join('\n')}\n] as const;\n`;
}

function motionRows(cells: Cell[][], frameIndex: number): string {
  const final = frameIndex === DURATIONS.length - 1;
  const density = ['.', ':', '+', '*', '#', '%', '@', '█'];
  return cells
    .map((row) => {
      const output: string[] = [];
      let active: { column: number; text: string; role: string } | undefined;
      for (let x = 0; x < WIDTH; x += 1) {
        const component = row[x]?.role;
        let glyph = '';
        let role = '';
        if (component) {
          let start = x;
          while (
            start > 0 &&
            cells[row === cells[0] ? 0 : cells.indexOf(row)]?.[start - 1]?.role === component
          )
            start -= 1;
          let end = x;
          while (end + 1 < WIDTH && row[end + 1]?.role === component) end += 1;
          const normalizedX = (x - start) / Math.max(1, end - start);
          const componentIndex = ROLES.indexOf(component);
          const maturity = (frameIndex / 8 - (componentIndex * 0.22 + normalizedX * 0.34)) / 0.3;
          if (final || maturity > 0) {
            glyph = final
              ? '█'
              : (density[
                  Math.max(0, Math.min(density.length - 1, Math.floor(maturity * density.length)))
                ] ?? '.');
            role =
              glyph === '█'
                ? `brand.${component}`
                : glyph === '@'
                  ? 'flow.highlight'
                  : glyph === '.' || glyph === ':'
                    ? 'flow.dim'
                    : 'flow.energy';
          }
        }
        if (!glyph) {
          if (active) {
            output.push(
              `{ column: ${active.column}, text: '${active.text}', role: '${active.role}' }`,
            );
            active = undefined;
          }
          continue;
        }
        if (active && active.column + active.text.length === x && active.role === role)
          active.text += glyph;
        else {
          if (active)
            output.push(
              `{ column: ${active.column}, text: '${active.text}', role: '${active.role}' }`,
            );
          active = { column: x, text: glyph, role };
        }
      }
      if (active)
        output.push(`{ column: ${active.column}, text: '${active.text}', role: '${active.role}' }`);
      return `[${output.join(', ')}]`;
    })
    .map((row) => `    ${row}`)
    .join(',\n');
}

function generated(cells: Cell[][]): string {
  const header = runs(cells).replace(
    'export const CANONICAL_BRAND_WIDTH',
    'export type GeneratedBrandMotionRole = BrandMotionRole;\nexport const CANONICAL_BRAND_WIDTH',
  );
  const frames = DURATIONS.map(
    (durationMs, index) =>
      `  { durationMs: ${durationMs}, rows: [\n${motionRows(cells, index)}\n  ] },`,
  ).join('\n');
  return `${header}export const BRAND_ANIMATION = { width: ${WIDTH}, height: ${HEIGHT}, frames: [\n${frames}\n] } as const;\n`;
}

function check(): void {
  const cells = rasterize();
  const expectedTxt = txt(cells);
  const expectedGenerated = generated(cells);
  const actualTxt = fs.readFileSync(TXT_PATH, 'utf8');
  const actualGenerated = fs.readFileSync(GENERATED_PATH, 'utf8');
  if (actualTxt !== expectedTxt)
    throw new Error('Canonical TXT is stale; run npm run brand:generate');
  if (actualGenerated !== expectedGenerated)
    throw new Error('Generated brand data is stale; run npm run brand:generate');
}

function preview(): void {
  const finalOnly = process.argv.includes('--final');
  const frameArg = process.argv.find((arg) => arg.startsWith('--frame='));
  const width = Number(
    process.argv.find((arg) => arg.startsWith('--width='))?.split('=')[1] ?? WIDTH,
  );
  const noColor = process.argv.includes('--no-color') || process.env.NO_COLOR !== undefined;
  if (!Number.isInteger(width) || width < WIDTH)
    throw new Error('preview width must be at least 80');
  const index = finalOnly
    ? BRAND_ANIMATION.frames.length - 1
    : frameArg
      ? Number(frameArg.split('=')[1])
      : BRAND_ANIMATION.frames.length - 1;
  const frame = BRAND_ANIMATION.frames[index];
  if (!frame) throw new Error(`unknown frame: ${index}`);
  process.stdout.write(
    renderBrandFrame(
      frame,
      width,
      noColor ? { NO_COLOR: '1' } : process.env,
      !noColor,
      width > WIDTH,
    ),
  );
}

const mode = process.argv[2] ?? 'check';
if (mode === 'generate') {
  const cells = rasterize();
  fs.writeFileSync(TXT_PATH, txt(cells));
  fs.writeFileSync(GENERATED_PATH, generated(cells));
} else if (mode === 'check') check();
else if (mode === 'preview') preview();
else throw new Error(`Unknown brand motion mode: ${mode}`);
