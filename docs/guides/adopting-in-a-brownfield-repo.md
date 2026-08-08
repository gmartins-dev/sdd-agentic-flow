# Adopting in a brownfield repo

`init` and `discover` are read-only with respect to your source code — they only write
`.sdd/config.yml` and `.sdd/context/project-context.md`. This guide walks through adopting
`sdd-agentic-flow` in a repository that already has code, tests, and conventions, and how to
read what `discover` finds.

## 1. Run `init`

```bash
npx sdd-agentic-flow@0.7.0 init
```

This writes `.sdd/config.yml` (your declared policy — project name, source type, workflow
defaults, quality gates, safety defaults) and auto-runs discovery, writing
`.sdd/context/project-context.md`. Existing `.sdd/config.yml` files are preserved, never
overwritten — safe to re-run.

Use `init --interactive` if you want to set a specific agent target, language profile, or
feature profile instead of the defaults. See [configuration](../configuration.md).

## 2. Read what `discover` found

`.sdd/context/project-context.md` records signals it found in the repository — see
[configuration](../configuration.md#project-context) for the full signal list. Sections worth
checking for a brownfield adoption:

- **Documentation found** — confirms whether it picked up existing `AGENTS.md`/`CLAUDE.md`
  instructions, a `docs/` directory, or ADR directories. If your team already has architecture
  docs, this is where a skill would first look.
- **Architecture signals** — presence of `domain/`, `hexagonal/`, `ports/`, `adapters/`-style
  folders. If your repo follows a Ports & Adapters or DDD-flavored layout, this confirms it was
  detected; if it's missing when it shouldn't be, your architecture uses different folder names
  than the ones this package checks for, and that's fine — it's a signal, not a requirement.
- **CI/CD signals** — confirms it found `.github/workflows`, `.gitlab-ci.yml`, or `.circleci`.
- **Platform signals** — ORM (`prisma/schema.prisma`, `drizzle.config.*`) and feature-flag
  config presence.

If a signal you expected is missing, that's not an error — `discover` only checks a small,
explicit list of well-known filenames and folder names (see
[configuration](../configuration.md#project-context)); it does not parse code. Add anything it
missed to the `## Notes` section by hand.

## 3. Refresh after the project changes

```bash
npx sdd-agentic-flow@0.7.0 discover --force
```

`--force` fully regenerates `project-context.md`, so copy out any manual notes first. Without
`--force`, `discover` is a no-op if the file already exists — safe to run in CI or a pre-commit
hook without side effects.

## 4. Install a pack and start the loop

Once config and context exist, install a pack (`core` is the safe default) and follow the main
SDD flow from the [README](../../README.md#main-sdd-flow), starting with
`sdd-create-specs` against the existing codebase as evidence.
