# Roadmap

- **v1.4 (2026-08-09):** CLI UX & Guided Onboarding. Colored, TTY-aware status output;
  "did you mean" suggestions on unknown commands/packs/agents and a clearer `uninstall`
  neither-flag message; a new public `--quiet` flag on `init`/`install`/`uninstall`/`discover`;
  partial core-skill install detection in `doctor` and the bare-invocation screen; `doctor` fix
  hints; a new opt-in `doctor --check-updates` (the sole, explicit exception to "no network
  access by default"); a numbered interactive menu on bare invocation, offered only when the
  process is genuinely interactive (real TTY on both streams, no `CI` env var) and never
  affecting piped/scripted/CI/agent invocations; and two exit-code bug fixes. Stays
  zero-runtime-dependency throughout — every addition is hand-rolled, informed by patterns
  studied in `anomalyco/opencode` and `vercel-labs/skills`.
- **v1.3 (2026-08-08):** Uninstall completeness and post-command guidance. Added
  `uninstall --apply --full` for a genuine clean-reinstall reset — it removes
  `.sdd/context/project-context.md`, `.sdd/snapshots`, and `.sdd/reports` on top of what
  `--include-config` already covered, while `.specs/features` stays permanently protected, same
  as source code, under every flag combination. `init` and `install` now print a short
  "Suggested next step" line on success (pointing at `install core`, then `doctor` and
  `sdd-route`), suppressed during `doctor --smoke`'s internal calls so its own output stays
  clean. Also fixed a `docs/upgrading.md` line that overstated `.sdd/config.yml` as never
  touched by `uninstall`, when `--include-config`/`--full` always removed it on request. All
  changes are additive under the v1.0 stability commitment — no documented command or flag was
  removed or had its default meaning changed.
- **v1.2 (2026-08-08):** CLI UX audit and upgrade. Fixed a real bug where `doctor` (and
  `doctor --contracts`, and the language-profile check) reported false `WARN`s after the
  documented Quick Start flow (`init` → `install core`, default `--scope user`), because those
  checks were hardcoded to project scope and never looked at the resolved user-scope install
  location. Added `--br`/`--en` as shorthand aliases for `init --language pt-BR`/`en-US`; real
  per-command help (`help <command>` / `<command> --help`, previously only `init --help`
  existed and the other five commands `FAIL`ed on `--help`); and a contextual, read-only status
  screen for bare `npx sdd-agentic-flow` (no command) instead of silently aliasing to the full
  `help` reference. All changes are additive under the v1.0 stability commitment — no
  documented command or flag was removed or had its default meaning changed.
- **v1.1 (2026-08-08):** dropped Node.js 18/20 as supported versions — CI-required minimum is
  now Node 22 (Maintenance LTS), with 24 (Active LTS) and 26 (Current) also required; a
  compatibility-reducing change under the v1.0 stability commitment, so it ships as a minor
  release with a matching `CHANGELOG.md` entry rather than silently. Also fixed four
  independent CI bugs (macOS `bash` 3.2 vs `mapfile`, Windows CRLF vs Biome, Windows `.cmd`
  spawn without a shell, Puppeteer sandbox on `ubuntu-latest`) and switched CI from
  `npm install` to `npm ci` for reproducible installs.
- **v1.0 (2026-08-08):** public go-live — first public stability commitment. The CLI's
  documented argument surface and the environment support matrix now follow the same
  minor/major-only change rule already established for skill capability contracts (see the
  "v1.0 stability commitment" section in [compatibility promise](docs/compatibility-promise.md)).
  No new product features; this release audits and freezes what v0.6–v0.9 already built.
- **v1.x (open):** future work adopted from validated need, not assumed in advance — candidates
  include adapters beyond `local-files`/`github` (Jira, Linear, Azure DevOps, Notion, Slack) and
  maturity-model documentation. Nothing in this line is committed or scheduled.

- **v0.1:** local-first core and full public skill pack.
- **v0.2:** Adoption & Trust Release: interactive setup, local validation, rollback, agent docs, and public examples.
- **v0.3:** Language Profiles & Brazilian Workflow Release.
- **v0.4:** TDD Implementation Baseline.
- **v0.5:** Workflow Navigation & Task Quality.
- **v0.6:** Foundation Architecture Release — capability contracts, a baseline registry,
  project discovery and context, feature profiles, and a baseline compliance gate.
- **v0.7:** Operational Excellence (start) — capability contracts v2 (`depends_on`/`conflicts`
  plus consumer-side `doctor --contracts`), light artifact contracts, Project Discovery 2.0
  (architecture/CI/platform signals), an agent-neutrality regression guard and action
  vocabulary, the first decision guides and a compatibility matrix, and the
  `sdd-reverse-engineer` skill.
- **v0.8:** Flow Consolidation & Dynamic Project Context Release — resolved
  `sdd-reverse-engineer`'s place in the Flow by merging it into `sdd-create-specs` as an
  existing-code mode, restoring a single entry point for the Specification step (12 skills →
  11). Also formalized Dynamic Project Context:
  `project-context.md` now carries provenance (generated-at, repository revision, branch), with
  new `context status`/`context refresh` commands to inspect and regenerate it explicitly,
  additive to the unchanged `discover [--force]`. Deliberately no Context Indexing, Context
  Query, knowledge graph, RAG, or vector database — those remain out of scope for the core
  product, to protect the toolkit's focused SDD-flow identity.
- **v0.9:** Installation, Portability & Public Readiness Release — `install` defaults to a
  zero-project-footprint `--scope user`, with an Agent Integration Layer for 4 officially
  supported agents (Codex CLI, Cursor, Claude Code, VS Code + GitHub Copilot); a cross-platform
  CI matrix (Node 18–24 on Linux, full pipeline on macOS/Windows) and a centralized platform
  layer in the CLI; a vendored `requires_cli` version-compatibility gate; the skill catalog
  (`docs/skills-catalog.md`); 5 golden flows proved as integration tests; and
  `docs/upgrading.md`/`docs/troubleshooting.md`/`docs/environment-compatibility.md` closing the
  documentation gaps the beta had accumulated. See `CHANGELOG.md` for the full list. Skill
  cards ✅ delivered (`docs/skills-catalog.md`).

With v1.0.0, the project leaves beta: the CLI argument surface and environment support matrix
now carry the stability commitment described at the top of this file. Future v1.x scope
remains open and will be defined from validated needs rather than assumed in advance.
