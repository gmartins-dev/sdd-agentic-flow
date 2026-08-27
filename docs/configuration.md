# Configuration

`.sdd-agentic-flow/config.yml` is optional. When it is absent, SAF uses the
built-in v3 policy, including `apply + supervised`, `.specs/features`, and
`en-US`. Create it only to persist project-specific overrides for specs root,
language, workflow, or safety. `init` never creates or overwrites it. See
[language profiles](language-profiles.md).

Keep `quality` gates enabled unless the project records an explicit exception. The `safety`
keys keep commit, push, and merge/deploy disabled by default.

`quality.require_tdd: true` keeps that key name. It means the **evidence
contract**: adequate behavioral sensors at contractual seams, plus recorded current
evidence. It does **not** mean the RED → GREEN → REFACTOR ritual is mandatory. Do not
rename or deprecate the key. See [TDD baseline](tdd-baseline.md) and
[shared/references/evidence-standard.md](../shared/references/evidence-standard.md).

## Installation intent

Use `config installation --plan` to preview installation intent and target paths. It does not
install skills; run `install` to reconcile. `install --plan` is human-readable when piped
or run in CI; only explicit `--json` output is machine structured.

`init` writes the local workspace marker and generated project context. It
preserves existing config. Installation intent controls the selected adoption
mode and its SAF-owned blocks in `.git/info/exclude`; `init` does not infer
project visibility. See [installation scope](installation-scope.md).

## Adoption intent

`adoption_mode` is an optional field in the user-local installation-intent v3 document
intent. Its values are `personal`, `specs-shared`, and `team`. It describes the desired project
footprint; it is not Git authority and does not belong in `.sdd-agentic-flow/config.yml`.
Install scope remains the independent `user` or `project` skill choice. Existing intents without
the field are `unclassified` and preserve their current visibility until an explicit choice is
confirmed. SAF never edits `.gitignore`, global excludes, or tracked files.

## Autonomy fields (`workflow.execution_mode`, `workflow.autonomy_level`)

`workflow.execution_mode` (`plan`/`guided`/`apply`/`review`/`full`, default `apply`) and
`workflow.autonomy_level` (`manual`/`supervised`/`autonomous`, default `supervised`) are two
orthogonal axes: `execution_mode` answers "what is a skill authorized to do," `autonomy_level`
answers "does a skill need a human between it and the next one." `plan` and `guided` never
combine with `autonomous`. `doctor --autonomy` flags either combination as `FAIL`. Use
`config policy` (interactive TTY, or `--plan` / `--yes` for CI) to persist an override.
`execution_mode`, `autonomy_level`, and `profile`/`human_outputs` are CLI-editable. The
`workflow.feature_profile` field is an advanced explicit project override; normal guided setup
does not ask for it and feature creation normally infers a profile in the feature context. Other
keys remain manual YAML edits. Use
`config policy --plan` to preview the complete change, then `--yes` for a non-interactive
apply. See
[commands.md](commands.md). Optional per-skill overrides live under `workflow.skill_overrides`:
documented here, not editable via `config policy` yet. `workflow.autonomy_budget`
(`max_iterations`, `max_tokens`, `max_runtime_hours`, `pause_on_warning`) bounds how much work an
`autonomous` run may do before it must stop and hand control back. See
[autonomy levels](autonomy-levels.md) for the full model, including the 7 guardrails that gate
every automatic transition, and `doctor --autonomy` / `context autonomy-state` /
`autonomous-resume` for the CLI surface.

## Project context

`init` also creates `.sdd-agentic-flow/context/project-context.md`, a read-only, auto-discovered record of
signals found in the repository (README, `AGENTS.md`/`CLAUDE.md`/`CODEX.md`/`GEMINI.md`, `docs/`,
ADR directories, `package.json` identity and workspace declarations, monorepo tooling config, test
config, architectural folder naming, CI configuration, and ORM/feature-flag configuration). It is
distinct from `.sdd-agentic-flow/config.yml`: config.yml holds user-declared policy, while `project-context.md`
holds discovered facts and is never written by hand.

Signals detected (all presence-only checks; no file content is parsed beyond `package.json`):

- **Project identity:** `package.json` name/description, README presence.
- **Documentation:** AI instruction files (`AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `GEMINI.md`),
  `docs/` directory, ADR directories.
- **Workspace / monorepo:** `package.json` workspaces field, `pnpm-workspace.yaml`,
  `turbo.json`, `nx.json`, `lerna.json`.
- **Testing:** `jest.config.*`, `vitest.config.*`, `pytest.ini`, `pyproject.toml`.
- **Architecture:** folder naming conventions: `domain/`, `hexagonal/`, `ports/`, `adapters/`
  (and their `src/` variants).
- **CI/CD:** `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`.
- **Platform:** ORM config (`prisma/schema.prisma`, `drizzle.config.ts`/`.js`) and feature-flag
  config (`.launchdarkly.yml`, `unleash.yml`).

Run `npx sdd-agentic-flow context refresh` any time to refresh it after the project changes. Skills that consult project context read it only when it exists and
treat it as optional context, the same way they treat `.sdd-agentic-flow/context/domain-glossary.md`.

### Provenance and refresh

`project-context.md` is a derived, versioned snapshot, not authoritative source code. The
repository remains the source of truth. Every generated file records the provenance it was
produced from:

```text
> Generated by sdd-agentic-flow <package-version>
> Generated at: <ISO-8601 timestamp>
> Repository revision: <commit>
> Branch: <branch>
```

Repository revision and branch come from `git rev-parse HEAD` / `git rev-parse --abbrev-ref HEAD`
when the project is a Git repository; outside one, or without `git` installed, both fields
degrade gracefully to `not a git repository` / `unknown` rather than failing discovery.

Two commands read and act on this provenance:

- `npx sdd-agentic-flow context status`: reports whether context exists, when it was generated, and
  at which repository revision, without changing anything. If the current `HEAD` differs from the
  recorded revision, it states that fact plainly (never a heuristic "stale" verdict) and suggests
  a refresh.
- `npx sdd-agentic-flow context refresh`: regenerates `project-context.md` unconditionally, whether
  or not it already exists. It is the recommended way to refresh context going forward.
- `npx sdd-agentic-flow context autonomy-state`: read-only report of `workflow.execution_mode`/
  `autonomy_level` plus the last recorded `.sdd-agentic-flow/autonomy/loop-state.md`, if any. See
  [autonomy levels](autonomy-levels.md).

`doctor`'s `project_context` check also surfaces revision drift in its message when it detects
the repository has moved on since the recorded generation.
