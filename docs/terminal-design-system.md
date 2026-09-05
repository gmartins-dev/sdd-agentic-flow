# SAF terminal design system

The CLI has one presentation system for human-facing output. It keeps command semantics,
machine output, and workflow authority in their existing owners while giving human output a
shared vocabulary for color, spacing, glyphs, geometry, and next actions.

## Presentation context

`resolvePresentationContext()` in `src/ui.ts` resolves these independent capabilities:

| Field | Meaning |
| --- | --- |
| `mode` | `human-rich`, `human-plain`, or `machine` |
| `interactive` | stdin and stdout support an interactive session |
| `color` | ANSI color is safe for the target stream |
| `unicode` | Unicode glyphs are safe and enabled |
| `cursor` | cursor movement/redraw is available |
| `rawInput` | raw keyboard input is available |
| `animation` | transient progress is allowed |
| `width` | measured terminal width, with a safe fallback |

The mode truth table is:

| Situation | Presentation |
| --- | --- |
| Interactive TTY | rich structure, with color when available |
| Interactive TTY + `NO_COLOR` | rich structure, no ANSI color |
| `--ascii`, `SDD_ASCII=1`, `TERM=dumb` | numbered/plain interaction and ASCII fallbacks |
| Pipe, CI, redirected output, or non-TTY | deterministic human-plain output |
| `--json` | existing machine protocol, without decoration |

`NO_COLOR` changes color only. It does not collapse an otherwise interactive rich journey.
`--quiet` suppresses decorative next-step blocks, and machine output never receives human art.

## Shared primitives

`terminal-theme.ts` is the single declarative source of truth for the four foundations: Symbols,
Colors, Typography, and Spacing/Layout. `SAF_THEME` contains semantic colors, text roles, spacing,
breakpoints, and motion levels; `SAF_GLYPHS` exposes compatibility aliases with ASCII fallbacks.
`terminal-geometry.ts` owns visible terminal-cell mathematics;
ANSI escapes are stripped before measurement, and untrusted display values are sanitized before
styling. Long commands and paths remain copyable rather than being split in the middle of a token.

The approved rich structural vocabulary is intentionally small:

```text
Journey     ┌ │ ├ └ ─ ┐ ┘
Stage       ◇ ◆
Status      ✓ ! ✗ i
Selection   ● ○ ■ □
Navigation  → ← ↑ ↓ ↳ ▸ ▹
Brand       `public/ascii/saf-ascii-art.txt` → generated filled 80×34 small/medium/large terminal mask
```

Every semantic token has a deterministic printable-ASCII fallback. EAW-A glyphs are valid in
rich output, but cards, alignment, wrapping, truncation, redraw, and physical-row calculations
must use `terminal-geometry` rather than JavaScript string length. ASCII mode is the deterministic
escape hatch for terminals that render ambiguous-width glyphs differently.

Choices use `●` for selected and `○` for unselected. The focused/current row uses `▸`, and
secondary action/navigation rows use `▹`; SAF has no mouse-hover state and does not use `◎`.
Action rows such as Back, Cancel, Exit, and Advanced options never participate in selected state.
Structural glyphs must come from the registry. Localized prose may contain ordinary Unicode.
Emoji presentation, variation selectors, ZWJ sequences, Private Use Area glyphs, and font-specific
icons are not part of the structural vocabulary.

## Terminal foundations

The theme exposes semantic tokens rather than raw visual values. Colors support brand, text,
interaction, status, and border roles; typography maps display, title, section, body, value,
supporting, command, path, and keyboard-hint roles to normal, bold, dim, or italic emphasis; layout
tokens provide shared gutters, indentation, content width, section spacing, and 80/60/40-cell
breakpoints. Normal content uses the terminal's default foreground and background. `NO_COLOR`
removes hue without removing structure, and ASCII mode selects deterministic fallbacks.

Components must not create competing structural glyph maps, raw UI colors, independent breakpoints,
or independent spacing conventions. Geometry remains responsible for cell widths, wrapping,
truncation, and physical rows; the theme remains declarative.

The small façade in `src/terminal-components.ts` owns the reusable human pieces:

- brand and journey rows;
- status and next-action notes;
- bordered or borderless cards;
- the representative gallery/catalog.

The selector state machine remains authoritative for input semantics. Its renderer supplies rich
markers, ASCII fallbacks, stable description slots, cancellation, and a collapsed selection
summary after completion. Rendering never changes the selected value or transition rules.

## Welcome composition

The human welcome uses one shared composition: the canonical 80×34 terminal mask from
`public/ascii/saf-ascii-art.txt`, the display
title `SDD-AGENTIC-FLOW (SAF)`, the localized product description, and the localized tagline.
Rich interactive output centers each physical line by terminal-cell width and uses tokenized
vertical rhythm. It does not center against the viewport height. The package version remains on
the canonical `--version`, `version`, help, and machine surfaces rather than in the visual title.

The tagline uses the semantic italic text role. `NO_COLOR` removes hue but preserves rich
structure and supported non-color emphasis. The terminal mask preserves the approved filled
small→medium→large progression; its generated geometry is embedded in `brand-animation.generated.ts` and its palette is
owned by `terminal-theme.ts`. Plain, ASCII, pipe, CI, and non-TTY output remain left-aligned and deterministic. At 80+
columns and sufficient height, the mark uses the complete 80×34 canvas; smaller or short terminals use the progressive
`›  ››  ›››` / `>  >>  >>>` fallback without splitting localized text or canonical command/path
tokens.

`public/ascii/saf-ascii-art.txt` is a geometry contract, not a suggestion. The file is generated
from the three polygons in `public/imgs/symbol.svg` and checked byte-for-byte by `npm run brand:check`.
Responsive behavior selects the separate compact or minimal fallback instead of transforming the 80×34 asset.

Single-choice selectors show only the current focus while open: `◉` for the focused option and
`○` for other options. Multiple-choice selectors use the corresponding square states `▣`, `■`, and
`□`. Action rows such as Back, Cancel, and Exit retain the navigation markers `▸` and `▹`.

## Adoption and boundaries

Human-facing command flows use `terminalLog`, `terminalNext`, shared setup markers, or the
selector renderer. `terminal-theme.ts` owns semantic tokens; `ui.ts`, `terminal-ui.ts`,
`terminal-components.ts`, `selector.ts`, and `brand-art.ts` own presentation behavior. A
source-boundary check prevents new direct Clack or Picocolors imports, raw ANSI escapes, or
structural glyphs from spreading into domain modules.

`npm run ui:gallery` renders the gallery at a selected mode and width. `npm run ui:catalog`
regenerates the normalized representative catalog at 40, 54, 60, 80, 110, and 120 columns for `en-US`
and `pt-BR`, including rich color, rich `NO_COLOR`, ASCII, and plain human output. The catalog is
evidence for visual and copyability regressions; it is not a runtime protocol.

This system intentionally adds no TUI framework, command, flag, domain authority, telemetry,
network behavior, or runtime dependency. Machine JSON, version output, completion output, and
existing exit-code contracts remain owned by their existing modules.

## Release evidence

Before a release, run the focused UI tests, `npm run ui:catalog`,
`npm run cli:human-audit`, `npm run check`, and `npm run sanitize`. The broader release checklist
also runs dist/packed certification and the full matrix. Remote Node/OS CI remains external
evidence and is not represented by local results.
