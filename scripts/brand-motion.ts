import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SVG_PATH = path.join(ROOT, 'public/imgs/symbol.svg');
const TXT_PATH = path.join(ROOT, 'public/ascii/saf-ascii-art.txt');
const GENERATED_PATH = path.join(ROOT, 'src/brand-animation.generated.ts');
const SVG_WIDTH = 114;
const SVG_HEIGHT = 96;
export const WIDTH = 80;
const CELL_HEIGHT_RATIO = 0.5;
export const HEIGHT = Math.round(((SVG_HEIGHT * WIDTH) / SVG_WIDTH) * CELL_HEIGHT_RATIO);
const VARIANTS = {
  wide: { width: 80, height: 34 },
  medium: { width: 54, height: 23 },
  compact: { width: 33, height: 14 },
} as const;
export const RICH_SAMPLE_GRID = 4;
export const RICH_OCCUPANCY_THRESHOLD = 8;
export const ASCII_OCCUPANCY_THRESHOLD = 8;
const ROLES = ['small', 'medium', 'large'] as const;
const DURATIONS = [50, 55, 60, 65, 65, 70, 70, 75, 80, 0] as const;
type Role = (typeof ROLES)[number];
type Triangle = { role: Role; points: readonly [number, number][] };
type Cell = { role: Role | undefined };
type VariantCell = { role: Role | undefined; coverage: number };

function parseSvg(): Triangle[] {
  const svg = fs.readFileSync(SVG_PATH, 'utf8');
  const viewBox = svg
    .match(/viewBox\s*=\s*["']([^"']+)["']/)?.[1]
    ?.trim()
    .split(/\s+/)
    .map(Number);
  if (
    viewBox?.length !== 4 ||
    viewBox?.some((n) => !Number.isFinite(n)) ||
    viewBox?.[0] !== 0 ||
    viewBox?.[1] !== 0 ||
    viewBox?.[2] !== SVG_WIDTH ||
    viewBox?.[3] !== SVG_HEIGHT
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
      points?.length !== 3 ||
      points?.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))
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
      row.push({ role: hits[0]?.role });
    }
    cells.push(row);
  }
  for (const role of ROLES) {
    if (!cells.some((row) => row.some((cell) => cell.role === role)))
      throw new Error(`No raster coverage for ${role}`);
  }
  return cells;
}

function sampleRole(x: number, y: number, triangles: Triangle[]): Role | undefined {
  const hits = triangles.filter((triangle) => insideTriangle(x, y, triangle));
  const roles = new Set(hits.map((triangle) => triangle.role));
  if (roles.size > 1) throw new Error(`Overlapping raster sample ${x},${y}`);
  return hits[0]?.role;
}

function variantCells(width: number, height: number): VariantCell[][] {
  const triangles = parseSvg();
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      let coverage = 0;
      let role: Role | undefined;
      for (let sampleY = 0; sampleY < RICH_SAMPLE_GRID; sampleY += 1) {
        for (let sampleX = 0; sampleX < RICH_SAMPLE_GRID; sampleX += 1) {
          const sample = sampleRole(
            ((x + (sampleX + 0.5) / RICH_SAMPLE_GRID) * SVG_WIDTH) / width,
            ((y + (sampleY + 0.5) / RICH_SAMPLE_GRID) * SVG_HEIGHT) / height,
            triangles,
          );
          if (sample) {
            coverage += 1;
            role = sample;
          }
        }
      }
      return { role: coverage >= ASCII_OCCUPANCY_THRESHOLD ? role : undefined, coverage };
    }),
  );
}

type GeneratedRun = { column: number; text: string; role: string };

function appendRun(runs: GeneratedRun[], column: number, text: string, role: string): void {
  const previous = runs.at(-1);
  if (previous && previous.column + previous.text.length === column && previous.role === role) {
    previous.text += text;
    return;
  }
  runs.push({ column, text, role });
}

function richRows(width: number, height: number): GeneratedRun[][] {
  const triangles = parseSvg();
  return Array.from({ length: height }, (_, row) => {
    const runs: GeneratedRun[] = [];
    for (let x = 0; x < width; x += 1) {
      const subcell = (part: number): Role | undefined => {
        const roles = new Set<Role>();
        let coverage = 0;
        for (let sampleY = 0; sampleY < RICH_SAMPLE_GRID; sampleY += 1) {
          for (let sampleX = 0; sampleX < RICH_SAMPLE_GRID; sampleX += 1) {
            const role = sampleRole(
              ((x + (sampleX + 0.5) / RICH_SAMPLE_GRID) * SVG_WIDTH) / width,
              ((row + part * 0.5 + (sampleY + 0.5) / (RICH_SAMPLE_GRID * 2)) * SVG_HEIGHT) / height,
              triangles,
            );
            if (role) {
              coverage += 1;
              roles.add(role);
            }
          }
        }
        if (roles.size > 1) throw new Error(`Rich subcell role conflict at ${x},${row}`);
        return coverage >= RICH_OCCUPANCY_THRESHOLD
          ? (roles.values().next().value as Role | undefined)
          : undefined;
      };
      const top = subcell(0);
      const bottom = subcell(1);
      const composed = composeRichGlyph(top, bottom);
      if (composed.glyph !== ' ') appendRun(runs, x, composed.glyph, `brand.${composed.role}`);
    }
    return runs;
  });
}

export function composeRichGlyph(
  top: Role | undefined,
  bottom: Role | undefined,
): {
  glyph: string;
  role: Role | undefined;
} {
  if (top && bottom && top !== bottom) throw new Error('Rich subcell role conflict');
  return {
    glyph: top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ',
    role: top ?? bottom,
  };
}

function asciiRows(width: number, height: number): GeneratedRun[][] {
  const cells = variantCells(width, height);
  return cells.map((row, y) => {
    const runs: GeneratedRun[] = [];
    row.forEach((cell, x) => {
      if (!cell.role) return;
      const up = Boolean(cells[y - 1]?.[x]?.role);
      const down = Boolean(cells[y + 1]?.[x]?.role);
      const left = Boolean(row[x - 1]?.role);
      const right = Boolean(row[x + 1]?.role);
      const edge = !up || !down || !left || !right;
      const northwest = Boolean(cells[y - 1]?.[x - 1]?.role);
      const northeast = Boolean(cells[y - 1]?.[x + 1]?.role);
      const southwest = Boolean(cells[y + 1]?.[x - 1]?.role);
      const southeast = Boolean(cells[y + 1]?.[x + 1]?.role);
      const rising = !northwest && northeast && southwest;
      const falling = northwest && !northeast && southeast;
      const tip =
        (!northwest && northeast && !southwest && southeast) ||
        (northwest && !northeast && southwest && !southeast);
      const glyph = edge
        ? tip
          ? '>'
          : rising
            ? '/'
            : falling
              ? '\\'
              : !left || !right
                ? '|'
                : '+'
        : cell.role === 'small'
          ? '#'
          : cell.role === 'medium'
            ? '+'
            : '=';
      appendRun(runs, x, glyph, `brand.${cell.role}`);
    });
    return runs;
  });
}

function serializeRows(rows: GeneratedRun[][]): string {
  const serialized = rows.map((row) => `    ${serializeRow(row)}`).join(',\n');
  return `[\n${serialized}\n  ]`;
}

function serializeRow(row: GeneratedRun[]): string {
  return `[${row.map((run) => `{ column: ${run.column}, text: ${JSON.stringify(run.text)}, role: ${JSON.stringify(run.role)} }`).join(', ')}]`;
}

function variantSource(): string {
  const variants = Object.entries(VARIANTS).map(
    ([name, size]) =>
      `  ${name}: {\n    width: ${size.width}, height: ${size.height},\n    rich: ${serializeRows(richRows(size.width, size.height))},\n    ascii: ${serializeRows(asciiRows(size.width, size.height))},\n  },`,
  );
  return `export const BRAND_VARIANTS = {\n${variants.join('\n')}\n} as const;\n`;
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

function motionRows(cells: Cell[][], frameIndex: number, finalRows: GeneratedRun[][]): string {
  const final = frameIndex === DURATIONS.length - 1;
  if (final) return finalRows.map((row) => `    ${serializeRow(row)}`).join(',\n');
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
  const finalRows = richRows(VARIANTS.wide.width, VARIANTS.wide.height);
  const frames = DURATIONS.map(
    (durationMs, index) =>
      `  { durationMs: ${durationMs}, rows: [\n${motionRows(cells, index, finalRows)}\n  ] },`,
  ).join('\n');
  return `${header}export const RICH_SAMPLE_GRID = ${RICH_SAMPLE_GRID} as const;\nexport const RICH_OCCUPANCY_THRESHOLD = ${RICH_OCCUPANCY_THRESHOLD} as const;\nexport const ASCII_OCCUPANCY_THRESHOLD = ${ASCII_OCCUPANCY_THRESHOLD} as const;\nexport const BRAND_ANIMATION = { width: ${WIDTH}, height: ${HEIGHT}, frames: [\n${frames}\n] } as const;\n${variantSource()}`;
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

async function preview(): Promise<void> {
  const [{ formatBrandArt, writeBrandArt }, { BRAND_ANIMATION, renderBrandFrame }] =
    await Promise.all([import('../src/brand-art.js'), import('../src/brand-motion.js')]);
  const finalOnly = process.argv.includes('--final');
  const frameArg = process.argv.find((arg) => arg.startsWith('--frame='));
  const width = Number(
    process.argv.find((arg) => arg.startsWith('--width='))?.split('=')[1] ?? WIDTH,
  );
  const height = Number(
    process.argv.find((arg) => arg.startsWith('--height='))?.split('=')[1] ?? 48,
  );
  const variant = process.argv.find((arg) => arg.startsWith('--variant='))?.split('=')[1] ?? 'auto';
  const ascii = process.argv.includes('--ascii');
  const playback = process.argv.includes('--playback');
  const colorDepth = process.argv.find((arg) => arg.startsWith('--color-depth='))?.split('=')[1];
  const noColor = process.argv.includes('--no-color') || process.env.NO_COLOR !== undefined;
  if (!Number.isInteger(width) || width < 33) throw new Error('preview width must be at least 33');
  if (!Number.isInteger(height) || height < 1) throw new Error('preview height must be positive');
  if (variant !== 'auto' && !['wide', 'medium', 'compact'].includes(variant))
    throw new Error(`unknown variant: ${variant}`);
  if (colorDepth && !['none', 'ansi16', 'ansi256', 'truecolor'].includes(colorDepth))
    throw new Error(`unknown color depth: ${colorDepth}`);
  const stream = {
    isTTY: true,
    columns: width,
    rows: height,
    write: (chunk: string) => {
      process.stdout.write(chunk);
      return true;
    },
  };
  const env = noColor
    ? { ...process.env, NO_COLOR: '1' }
    : colorDepth === 'truecolor'
      ? { ...process.env, COLORTERM: 'truecolor' }
      : colorDepth === 'ansi256'
        ? { ...process.env, TERM: 'xterm-256color' }
        : colorDepth === 'ansi16'
          ? { ...process.env, TERM: 'xterm' }
          : colorDepth === 'none'
            ? { ...process.env, NO_COLOR: '1' }
            : process.env;
  if (variant !== 'auto' || ascii || playback) {
    const previewOptions: { variant?: 'wide' | 'medium' | 'compact' } = {};
    if (variant !== 'auto') previewOptions.variant = variant as 'wide' | 'medium' | 'compact';
    if (playback) {
      await writeBrandArt(ascii ? 'human-plain' : 'human-rich', stream, env, previewOptions);
      return;
    }
    process.stdout.write(
      formatBrandArt(ascii ? 'human-plain' : 'human-rich', stream, env, previewOptions),
    );
    return;
  }
  if (width < WIDTH) {
    process.stdout.write(formatBrandArt('human-rich', stream, env, { center: true }));
    return;
  }
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

if (path.basename(process.argv[1] ?? '') === 'brand-motion.ts') {
  const mode = process.argv[2] ?? 'check';
  if (mode === 'generate') {
    const cells = rasterize();
    fs.writeFileSync(TXT_PATH, txt(cells));
    fs.writeFileSync(GENERATED_PATH, generated(cells));
  } else if (mode === 'check') check();
  else if (mode === 'preview')
    preview().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  else throw new Error(`Unknown brand motion mode: ${mode}`);
}
