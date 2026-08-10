# Upgrading

## What is always preserved

`install` never touches `.sdd/config.yml`. `uninstall` only removes it when explicitly asked
(`--include-config` or `--full`); its default (`--apply` with neither flag) leaves it alone too.
`.specs/features/**` is never removed by either command, under any flag combination. See
[uninstall](uninstall.md) for the exact preservation list, including the `--full` reset for a
clean reinstall. Re-running `install <pack>` is always safe: it is idempotent, and only writes
files that are missing (`copyIfMissing`); it never overwrites an existing file. This holds
across every version.

## When is re-running `install` safe?

Always. Whatever pack and scope you already used, running `install <pack>` again, with the
same flags, either no-ops (everything already present, reported as `preserved`) or fills in
files that are new in the installed version. There is no migration step to run manually.

## How to read a capability-contract change between versions

Skill contracts (`extends`/`requires`/`consumes`/`produces`/`baseline`/`compatible_with`, plus
the optional `depends_on`/`conflicts`/`requires_cli`) can change on a minor release during the
beta, always called out in `CHANGELOG.md` under a "Breaking capability-contract change" note.
See [compatibility promise](compatibility-promise.md) for exactly what counts as breaking vs.
additive, and run `sdd-agentic-flow doctor --contracts` after upgrading to mechanically confirm
your installed skills are internally consistent.

## Two concrete examples

### 1. A skill disappears between versions (`sdd-reverse-engineer` → v0.8.0)

In v0.8.0, `sdd-reverse-engineer` was merged into `sdd-create-specs` as an internal
"existing-code mode." The standalone skill stopped existing. If you had it installed: running
`install <pack>` again with the current version replaces the installed skill files with the
current set (the old `sdd-reverse-engineer` directory is not auto-removed, since `install`
only ever adds missing files; remove it explicitly with `uninstall`, or leave it as an inert
leftover directory; either is safe). Nothing else is required. The same outcome (documenting
existing code) is now reached through `sdd-create-specs`.

### 2. `install`'s default scope changes to `user` (v0.9.0)

Before v0.9.0, `install` always wrote into the project. There was no scope flag, so today's
`--scope project` was the only possible behavior. If you already had a project-scope
installation (an `.agents/skills/` directory in your repository), upgrading the CLI changes
nothing about those files: they stay exactly as they were. The only behavior change is
forward-looking. Running `install <pack>` again **without** `--scope project` now writes to
your global per-agent skill directories instead of the project. To keep installing into the
project going forward, pass `--scope project` explicitly. See
[installation scope](installation-scope.md) for the full scope model, and the
["version migration" golden flow](../examples/golden/version-migration/walkthrough.md) for the
integration test that proves this exact scenario end to end.
