# Contributing

Keep changes small, documented, and covered by `npm run check` and `npm run sanitize`.

## Maintainer toolchain (TypeScript strict)

Canonical Node code lives under `src/` (strict TypeScript). The published CLI is compiled
CommonJS in `dist/`. Tests and maintainer scripts are `test/*.test.ts` and `scripts/*.ts`.

Gate order in `npm run check` is:

```text
tsc (strict) → build (dist/) → Biome (format + style) → YAML/docs/shell gates → tests
```

| Command | Role |
| --- | --- |
| `npm run typecheck` | Strict TypeScript on `src/`, `test/`, `scripts/` (`tsconfig.json`) |
| `npm run build` | Clean emit of `src/` → `dist/` (`tsconfig.build.json`) |
| `npm run lint:biome` | Biome format + lint (no type semantics — that is `tsc`) |
| `npm run lint:biome:fix` | Apply Biome fixes and organize imports |
| `npm run lint` | `typecheck` then `lint:biome` |
| `npm run lint:fix:all` | Biome fix + YAML Prettier + markdown fix |

Biome config: `biome.json` (ignores `dist/`, `.specs/`, `.local/`; TypeScript uses the same
formatter rules as JavaScript). Do not reintroduce retired `node --check` file lists.

### Where new CLI code belongs

Before adding CLI logic, read the [Maintainer source layout](docs/architecture.md#maintainer-source-layout)
module map in `docs/architecture.md`. Put new code in the module that already owns the command
or concern (`setup.ts` for init, `install.ts` for install, `doctor.ts` for health checks, and so
on). Keep `src/sdd-agentic-flow.ts` as a thin bootstrap/router — route to an existing module or
extract a new one when a responsibility does not fit an existing owner.

Proposing a new feature or direction? This project scopes work audit-first: a candidate idea
becomes real work only once a direct read of the current repository confirms a real gap, not
from an assumed roadmap slot or an external comparison. Each dated entry in `ROADMAP.md` is the
decision record for that release. It states the gap found, why, and what was deliberately left
out. Read a few recent entries before proposing scope.

Proposing a new skill? Read `shared/references/skill-authoring-standard.md` first — it documents
the six required `SKILL.md` sections and the `Status`/`Next recommended skill`/`Reason` output
convention every skill follows — and, for any skill that classifies a pass/fail/ready-style
outcome, `shared/references/evidence-standard.md`.

The local test suite shells out to the system `tar` CLI for one packaging-boundary test (it
extracts a real `npm pack` tarball and runs the extracted CLI); that test skips itself if `tar`
is not on `PATH`.

## Version bumps

Edit only `package.json` `"version"`, then run `npm run version:stamp`, check version consistency,
and add the matching `## x.y.z` section to `CHANGELOG.md`. The stamp writes skill
`metadata.version`, preset version fields, and the two package-lock root version fields; the CLI
reads `package.json` at runtime. See [docs/publishing.md](docs/publishing.md).
Do not hand-edit those copies, and do not stamp changelog or roadmap history.

## Testing CLI changes locally, without publishing

Two scripts let you try out a CLI change (wording, a new flag, onboarding flow) as if you were
a user, without ever running `npm publish`:

- **`npm run cli:dev -- <args>`** — fastest loop. Runs `dist/sdd-agentic-flow.js` (build first
  if needed) against a persistent scratch project + isolated `HOME` under your temp
  directory, so state (for example, an `install`, then `init`, then `doctor`) carries across runs
  like a real evolving project. Pass `--fresh` to wipe both and start over. Use this while
  iterating on a change — "did that wording come out right?"

- **`npm run cli:sandbox -- <args>`** — full new-user simulation. Runs `npm pack` to build the
  exact tarball `npm publish` would ship, then installs and runs it via
  `npx "file:<tarball>"` in a brand-new project directory with an isolated `HOME` — real npm
  package resolution and `bin` shim, not a shortcut. The sandbox directories are left in place
  afterward so you can inspect what got written (e.g. `.agents/skills`, `.sdd-agentic-flow/`); pass `--clean`
  to remove them automatically. Run this before a release, or whenever you want to confirm a
  change survives the actual packaging boundary.

Both scripts are TypeScript (`scripts/*.ts`) with no runtime dependency. The same
pack → install → run recipe used by `cli:sandbox` is also exercised automatically by the tarball
e2e tests in `test/cli.test.ts` — use the script for interactive poking, the tests for
regression coverage.

### Exhaustive CLI audit

Run `npm run cli:exhaustive` for the reusable black-box CLI audit. It exercises the documented
commands through realistic user journeys, isolated temporary projects/HOMEs, negative paths,
safe reconciliation, autonomy, uninstall, and a real packed-consumer flow. By default it writes
an independent Markdown report to `.local/gmm/sdd-agentic-flow/` using the filename
`v<version>-cli-test-report-YYYYMMDDTHHMMSSZ.md`; the same UTC timestamp is recorded in the
report header. Set `SAF_CLI_REPORT=/path/to/report.md` when a specific output path is needed.

## Diagrams

Diagrams use Mermaid as their textual, versionable source — always as inline ` ```mermaid `
code blocks in Markdown, never as separate `.mmd` files, matching the diagrams that already
exist in `README.md` and `docs/saf-skills-usage-guide.md`. Edit
`shared/templates/workflow-diagram.mmd` and run `npm run docs:fix` (or
`tsx scripts/sync-workflow-diagram.ts`) to sync README mermaid blocks. `npm run docs:diagrams`
`npm run docs:check`) renders every such block through `@mermaid-js/mermaid-cli` to catch
syntax errors; it is a **devDependency only** — never added to `dependencies`, and never a
runtime requirement of the distributed CLI (see `docs/environment-compatibility.md`).

## Git hooks

Run `git config core.hooksPath .githooks` once after cloning to enable the tracked
`commit-msg` hook, which strips any `Co-Authored-By:` trailer naming an AI coding agent
(Claude Code, Cursor, Codex, Copilot, and similar) before a commit is finalized — this
repository's contributor graph must attribute only the human maintainer (see `CLAUDE.md`).

## Policy constraints

Do not add a runtime dependency, `postinstall`, network-by-default behavior, a required
AI client, programming language, or framework without an explicit project decision.
Do not weaken the TLC baseline, safety defaults, attribution, licensing, or privacy
policy. Never add private context to docs, fixtures, examples, or tests.
