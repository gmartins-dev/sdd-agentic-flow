# Configuration

`.sdd-agentic-flow/config.yml` controls specs root, source type, language, workflow and safety.
The generated file is intentionally explicit and can be edited by the project owner.

It stores project name, default branch, agent target, language profile, human-output language,
source type, workflow choices, and quality gates. New projects use `en-US` by default. Use
`init --language pt-BR` for Brazilian Portuguese explanations while keeping technical tokens
canonical. `init` preserves an existing configuration; interactive init also exits without
overwriting it. See [language profiles](language-profiles.md).

Keep `quality` gates enabled unless the project records an explicit exception. The `safety`
keys keep commit, push, and merge/deploy disabled by default.

`quality.require_tdd: true` keeps that key name. In v1.14.0 it means the **evidence
contract**: adequate behavioral sensors at contractual seams, plus recorded current
evidence. It does **not** mean the RED → GREEN → REFACTOR ritual is mandatory. Do not
rename or deprecate the key. See [TDD baseline](tdd-baseline.md) and
[shared/references/evidence-standard.md](../shared/references/evidence-standard.md).

There is no dedicated `release` section yet — `saf-release` (see the
[skills catalog](skills-catalog.md)) reads whatever version-bearing files and changelog
conventions the project already uses, falling back to the most common pattern (a single
manifest plus a root-level changelog) and saying so explicitly when nothing is declared,
rather than assuming an undeclared convention silently.

## Installation intent

`configure` is separate from `config`: it edits the user-local installation intent at
`~/.sdd-agentic-flow/install.yml`, while `config` edits project workflow policy. The intent keeps
user packs and target IDs, plus per-repository project packs and `shared`/`local` sharing. It does
not install skills; run `install <pack>` to reconcile. For project-local sharing, SAF owns only
its exact `.git/info/exclude` block for `.agents/skills/` and removes only that block when sharing
changes back to shared.

Use `configure --plan` to preview both the saved intent and its later reconciliation. Its
`Save intent:` command reproduces the selected packs, targets, or sharing; run it before the
shown `Reconcile:` command. `install --plan` is human-readable when piped or run in CI; only
explicit `--json` output is machine structured.

`init` also writes `.sdd-agentic-flow/usage.md`, a short regenerable stub that points at the
canonical skills usage guide on GitHub. Re-running `init` refreshes that file and never
overwrites `config.yml`. Teams that want toolkit state hidden from `git status` without
editing `.gitignore` can pass `init --local-git-exclude` (opt-in; excludes only
`.sdd-agentic-flow/`, never `.specs/`). See [installation scope](installation-scope.md).

## Autonomy fields (`workflow.execution_mode`, `workflow.autonomy_level`)

`workflow.execution_mode` (`plan`/`guided`/`apply`/`review`/`full`, default `guided`) and
`workflow.autonomy_level` (`manual`/`supervised`/`autonomous`, default `manual`) are two
orthogonal axes: `execution_mode` answers "what is a skill authorized to do," `autonomy_level`
answers "does a skill need a human between it and the next one." `plan` and `guided` never
combine with `autonomous`. `doctor --autonomy` flags either combination as `FAIL`. `init --preset` writes both fields from an operating-policy name (`manual` →
`guided`+`manual`, `supervised` → `apply`+`supervised`, `autonomous` → `full`+`autonomous`)
and cannot combine with `--execution-mode` or `--autonomy-level`. `init
--autonomy-level`/`--execution-mode` set both at creation time; both default to their most
conservative value, so an existing `.sdd-agentic-flow/config.yml` predating v1.8.0 behaves identically once
these fields are added (`WARN`, not `FAIL`, when missing). After init, change operating policy with
`config policy` (interactive TTY, or `--plan` / `--yes` for CI). Only `execution_mode` and
`autonomy_level` are CLI-editable in v3.0.0; other keys remain manual YAML edits. See
[commands.md](commands.md). Optional per-skill overrides live under `workflow.skill_overrides` —
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
treat it as optional context, the same way they treat `.sdd-agentic-flow/context/domain-glossary.md`.

### Provenance and refresh

`project-context.md` is a derived, versioned snapshot, not authoritative source code. The
repository remains the source of truth. Every generated file records the provenance it was
produced from:

```text
> Generated by sdd-agentic-flow 1.4.0
> Generated at: 2026-08-08T12:00:00.000Z
> Repository revision: 91ac42e...
> Branch: main
```

Repository revision and branch come from `git rev-parse HEAD` / `git rev-parse --abbrev-ref HEAD`
when the project is a Git repository; outside one, or without `git` installed, both fields
degrade gracefully to `not a git repository` / `unknown` rather than failing discovery.

Two commands read and act on this provenance:

- `sdd-agentic-flow context status`: reports whether context exists, when it was generated, and
  at which repository revision, without changing anything. If the current `HEAD` differs from the
  recorded revision, it states that fact plainly (never a heuristic "stale" verdict) and suggests
  a refresh.
- `sdd-agentic-flow context refresh`: regenerates `project-context.md` unconditionally, whether
  or not it already exists. It is equivalent to `discover --force` but does not require
  remembering the flag, and is the recommended way to refresh context going forward; `discover
  [--force]` keeps working exactly as before for existing scripts and CI.
- `sdd-agentic-flow context autonomy-state`: read-only report of `workflow.execution_mode`/
  `autonomy_level` plus the last recorded `.sdd-agentic-flow/autonomy/loop-state.md`, if any. See
  [autonomy levels](autonomy-levels.md).

`doctor`'s `project_context` check also surfaces revision drift in its message when it detects
the repository has moved on since the recorded generation.
