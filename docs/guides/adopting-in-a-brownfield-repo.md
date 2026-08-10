# Adopting in a brownfield repo

`init` and `discover` are read-only with respect to your source code. They only write
`.sdd/config.yml` and `.sdd/context/project-context.md`. Follow these steps to adopt
`sdd-agentic-flow` in a repository that already has code, tests, and conventions.

## 1. Run `init`

```bash
npx sdd-agentic-flow init
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
npx sdd-agentic-flow discover --force
```

`--force` fully regenerates `project-context.md`, so copy out any manual notes first. Without
`--force`, `discover` is a no-op if the file already exists — safe to run in CI or a pre-commit
hook without side effects.

The friendlier equivalent is:

```bash
npx sdd-agentic-flow context status    # see when it was generated and at which revision
npx sdd-agentic-flow context refresh   # regenerate it unconditionally
```

`context status` reads the provenance recorded in the file (generated-at timestamp, repository
revision, branch) and tells you plainly whether the repository has moved on since generation —
useful after a brownfield repo has had significant changes since you last ran `init`/`discover`.
`context refresh` does the same full regeneration as `discover --force`, without needing to
remember the flag.

## 4. Install a pack and start the loop

Once config and context exist, install a pack (`core` is the safe default) and follow the main
SDD flow from the [README](../../README.md#main-sdd-flow), starting with `sdd-create-specs`.

If the code you're bringing under SDD already exists with no prior spec and no requested
outcome to start from, ask for `sdd-create-specs` in its **existing-code mode**: name an
explicit scope (a module, feature, or bounded area — never the whole repository) and it will
reconstruct `context.md`, `spec.md`, and `design.md` from the code and its tests, labeling
every requirement and decision **Observed**, **Inferred**, or **Unknown** so you can confirm or
correct each inference before relying on it. If instead you already have a requested outcome or
ticket to implement, use the same skill's default source-item mode.
