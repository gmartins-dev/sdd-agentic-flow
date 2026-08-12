# Installation

Requires Node.js >= 22 to run the CLI (see [environment compatibility](environment-compatibility.md)
for the full matrix). That requirement applies to the CLI only. The project you're installing
into can be written in any language; the CLI never adds a dependency to it.

Install the package, run `npx sdd-agentic-flow init`, then install the smallest pack
that fits the project. Re-running installation preserves existing files.

```bash
npx sdd-agentic-flow init
npx sdd-agentic-flow install core
npx sdd-agentic-flow doctor
```

Use `init --interactive` when selecting initial project defaults. `init` always writes
project-local configuration (`.sdd-agentic-flow/config.yml`, `.sdd-agentic-flow/context/project-context.md`)
and a regenerable usage stub (`.sdd-agentic-flow/usage.md`) that points at the canonical
[skills usage guide](https://github.com/gmartins-dev/sdd-agentic-flow/blob/main/docs/sdd-skills-usage-guide.md)
on GitHub — the consumer project does not receive a copy of package `docs/`. That part
is unaffected by install scope.

Pass `init --local-git-exclude` to append `.sdd-agentic-flow/` to `.git/info/exclude` so
toolkit state stays out of `git status` without editing the team's `.gitignore`. Default
off. Specs under `.specs/` are not excluded. See [installation scope](installation-scope.md).

`install <pack>` defaults to `--scope user`: it writes only to global, per-agent skill
directories (e.g. `~/.claude/skills`) and creates **zero files in the project**. Pass
`--scope project` to install into `.agents/skills/` inside the project instead. That matches the
pre-v0.9.0 behavior. See [installation scope](installation-scope.md) for the full two-scope
model, the supported agents, and `--plan`/`--agent`.

Use `init --language en-US` or `init --language pt-BR` (or the `--en`/`--br` shorthands) to
select a profile without the interactive prompts. The default is `en-US`.

Run `npx sdd-agentic-flow list` before installation to inspect pack membership. The installer
never downloads or overwrites assets.

Add `--quiet` to `init` or `install` to suppress the "Suggested next step" line printed on
success.
