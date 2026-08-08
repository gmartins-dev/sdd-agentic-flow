# Configuration

`.sdd/config.yml` controls specs root, source type, language, workflow and safety.
The generated file is intentionally explicit and can be edited by the project owner.

It stores project name, default branch, agent target, language profile, human-output language,
source type, workflow choices, and quality gates. New projects use `en-US` by default. Use
`init --language pt-BR` for Brazilian Portuguese explanations while keeping technical tokens
canonical. `init` preserves an existing configuration; interactive init also exits without
overwriting it. See [language profiles](language-profiles.md).

Keep `quality` gates enabled unless the project records an explicit exception. The `safety`
keys keep commit, push, and merge/deploy disabled by default.

## Project context

`init` also creates `.sdd/context/project-context.md`, a read-only, auto-discovered record of
signals found in the repository (README, `AGENTS.md`/`CLAUDE.md`/`CODEX.md`/`GEMINI.md`, `docs/`,
ADR directories, `package.json` identity and workspace declarations, monorepo tooling config, test
config, architectural folder naming, CI configuration, and ORM/feature-flag configuration). It is
distinct from `.sdd/config.yml`: config.yml holds user-declared policy, while `project-context.md`
holds discovered facts and is never written by hand.

Signals detected (all presence-only checks — no file content is parsed beyond `package.json`):

- **Project identity** — `package.json` name/description, README presence.
- **Documentation** — AI instruction files (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `GEMINI.md`),
  `docs/` directory, ADR directories.
- **Workspace / monorepo** — `package.json` workspaces field, `pnpm-workspace.yaml`,
  `turbo.json`, `nx.json`, `lerna.json`.
- **Testing** — `jest.config.*`, `vitest.config.*`, `pytest.ini`, `pyproject.toml`.
- **Architecture** — folder naming conventions: `domain/`, `hexagonal/`, `ports/`, `adapters/`
  (and their `src/` variants).
- **CI/CD** — `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`.
- **Platform** — ORM config (`prisma/schema.prisma`, `drizzle.config.ts`/`.js`) and feature-flag
  config (`.launchdarkly.yml`, `unleash.yml`).

Run `sdd-agentic-flow discover` any time to refresh it after the project changes, or
`sdd-agentic-flow discover --force` to fully regenerate it (this rewrites the whole file, so copy
out any manual notes first). Skills that consult project context read it only when it exists and
treat it as optional context, the same way they treat `.sdd/context/domain-glossary.md`.
