# Installation

Requires Node.js >= 22 to run the CLI (see [environment compatibility](environment-compatibility.md)
for the full matrix). That requirement is about the CLI only — the project you're installing
into can be written in any language; the CLI never adds a dependency to it.

Install the package, run `npx sdd-agentic-flow init`, then install the smallest pack
that fits the project. Re-running installation preserves existing files.

```bash
npx sdd-agentic-flow init
npx sdd-agentic-flow install core
npx sdd-agentic-flow doctor
```

Use `init --interactive` when selecting initial project defaults. `init` always writes
project-local configuration (`.sdd/config.yml`, `.sdd/context/project-context.md`) — that part
is unaffected by install scope.

`install <pack>` defaults to `--scope user`: it writes only to global, per-agent skill
directories (e.g. `~/.claude/skills`) and creates **zero files in the project**. Pass
`--scope project` to install into `.agents/skills/` inside the project instead — the
pre-v0.9.0 behavior. See [installation scope](installation-scope.md) for the full two-scope
model, the supported agents, and `--plan`/`--agent`.

Use `init --language en-US` or `init --language pt-BR` (or the `--en`/`--br` shorthands) to
select a profile without the interactive prompts. The default is `en-US`.

Run `npx sdd-agentic-flow list` before installation to inspect pack membership. The installer
never downloads or overwrites assets.
