# Contributing

Keep changes small, documented, and covered by `npm run check` and `npm run sanitize`.

Proposing a new feature or direction? This project scopes work audit-first: a candidate idea
becomes real work only once a direct read of the current repository confirms a real gap, not
from an assumed roadmap slot or an external comparison. Each dated entry in `ROADMAP.md` is the
decision record for that release — it states the gap found, why, and what was deliberately left
out. The `v1.9.2` entry is a live example: 2 of 3 candidate items shipped on a confirmed narrow
gap, the third stayed out because its own stated precondition was not met. Read a few recent
entries before proposing scope.

Proposing a new skill? Read `shared/references/skill-authoring-standard.md` first — it documents
the six required `SKILL.md` sections and the `Status`/`Next recommended skill`/`Reason` output
convention every skill follows — and, for any skill that classifies a pass/fail/ready-style
outcome, `shared/references/evidence-standard.md`.

The local test suite shells out to the system `tar` CLI for one packaging-boundary test (it
extracts a real `npm pack` tarball and runs the extracted CLI); that test skips itself if `tar`
is not on `PATH`.

## Version bumps

Edit only `package.json` `"version"`, then run `npm run version:stamp` and add the matching
`## x.y.z` section to `CHANGELOG.md`. The stamp writes skill `metadata.version` and preset
`version` fields; the CLI reads `package.json` at runtime. See [docs/publishing.md](docs/publishing.md).
Do not hand-edit those copies, and do not stamp changelog or roadmap history.

## Testing CLI changes locally, without publishing

Two scripts let you try out a CLI change (wording, a new flag, onboarding flow) as if you were
a user, without ever running `npm publish`:

- **`npm run cli:dev -- <args>`** — fastest loop. Runs `bin/sdd-agentic-flow.js` straight from
  source (no packing) against a persistent scratch project + isolated `HOME` under your temp
  directory, so state (e.g. an `init`, then `install core`, then `doctor`) carries across runs
  like a real evolving project. Pass `--fresh` to wipe both and start over. Use this while
  iterating on a change — "did that wording come out right?"

- **`npm run cli:sandbox -- <args>`** — full new-user simulation. Runs `npm pack` to build the
  exact tarball `npm publish` would ship, then installs and runs it via
  `npx "file:<tarball>"` in a brand-new project directory with an isolated `HOME` — real npm
  package resolution and `bin` shim, not a shortcut. The sandbox directories are left in place
  afterward so you can inspect what got written (e.g. `.agents/skills`, `.sdd-agentic-flow/`); pass `--clean`
  to remove them automatically. Run this before a release, or whenever you want to confirm a
  change survives the actual packaging boundary.

Both scripts are plain Node with no new dependency, matching `scripts/pack-dry.js`. The same
pack → install → run recipe used by `cli:sandbox` is also exercised automatically by the tarball
e2e tests in `test/cli.test.js` — use the script for interactive poking, the tests for
regression coverage.

## Diagrams

Diagrams use Mermaid as their textual, versionable source — always as inline ` ```mermaid `
code blocks in Markdown, never as separate `.mmd` files, matching the diagrams that already
exist in `README.md` and `docs/sdd-skills-usage-guide.md`. `npm run docs:diagrams` (part of
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
