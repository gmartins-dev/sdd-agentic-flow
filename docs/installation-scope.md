# Installation scope

`install` supports two explicit scopes. `user` is the default: it never touches the
consumer project. `project` is opt-in and matches the toolkit's pre-v0.9.0 behavior.

| Scope             | What `install <pack>` does                                     | Trace in the project                                                            |
| ------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `user` (default)   | Copies skills into the global skill directories of each supported agent | None — no file or directory is created in `cwd`                              |
| `project` (opt-in) | Copies skills into `.agents/skills/` inside the project, same as `install` before v0.9.0 | Real files, appear as untracked in `git status`; the team decides whether to commit |

```bash
npx sdd-agentic-flow install core                       # scope: user (default), zero footprint
npx sdd-agentic-flow install core --scope project        # writes .agents/skills/ in the project
npx sdd-agentic-flow install core --plan                 # dry run: show what would be written, touch nothing
```

## Ownership boundary

The scope only applies to what `install` copies (skills). It never applies to `.sdd/config.yml`
or `.sdd/context/project-context.md`, which are project policy, always created by
`init`/`discover`, and always live in the project regardless of scope.

| Category                          | Lives in                              | Owner        |
| ---------------------------------- | -------------------------------------- | ------------- |
| Installed skills                   | user-local (default) / project (opt-in) | user / team  |
| CLI installation config            | user-local                             | user         |
| `.sdd/config.yml` (project policy) | project                                | team         |
| `.sdd/context/project-context.md`  | project                                | team         |
| `.specs/features/**`               | project                                | team         |

## Agent Integration Layer

`sdd-agentic-flow` supports 4 agents officially. Each global (`user` scope) directory is
verified against that agent's own documentation:

| Agent                    | Global (`user` scope)                     | Project (`project` scope) | Source                                                                                          |
| -------------------------- | -------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Codex CLI                | `$HOME/.agents/skills/`                      | `.agents/skills/`             | [developers.openai.com/codex](https://learn.chatgpt.com/docs/build-skills)                          |
| Cursor                   | `~/.agents/skills/` and `~/.cursor/skills/`  | `.agents/skills/` and `.cursor/skills/` | [cursor.com/help/customization/skills](https://cursor.com/help/customization/skills)                |
| Claude Code               | `~/.claude/skills/<name>/SKILL.md`           | `.claude/skills/<name>/SKILL.md` | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)                            |
| VS Code + GitHub Copilot  | `~/.copilot/skills/`                         | `.agents/skills/`, `.github/skills/`, `.claude/skills/` | [code.visualstudio.com/docs/agent-customization/agent-skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) |

Without `--agent`, `install` writes to 3 fixed global targets by default: `~/.agents/skills/`
(Codex CLI + Cursor, and Copilot's fallback path), `~/.claude/skills/` (Claude Code), and
`~/.copilot/skills/` (GitHub Copilot). Writing to all 3 by default costs a few extra KB and
avoids any need to detect "which agent is installed" — detection is out of scope for this
release (see the [v0.9.0 non-scope list](compatibility-promise.md)).

Restrict to a single agent with `--agent`:

```bash
npx sdd-agentic-flow install core --agent claude-code
```

If `.sdd/config.yml` declares a recognized `agent.target` (`codex`, `cursor`, `claude-code`, or
`vscode-copilot`), `install` uses it as the default `--agent` value when the flag is omitted.

**Agents not covered:** if `--agent` names something the CLI does not recognize, `install`
fails and states the limitation. It never falls back to writing into the project silently.

## `--plan`

`install <pack> --plan` is a dry run, same pattern as `uninstall --plan`: it lists what would
be created without touching anything. In `user` scope it always prints
`Repository changes: none`; in `project` scope it lists the real paths that would be written.

## `doctor`

`doctor` reports an "Installation" section: whether a valid installation exists at the
project target and at each of the 3 default user-scope targets, plus an explicit
`✓ No project files created by installation` line when scope `user` left the project untouched.

## `uninstall --scope`

`uninstall` also accepts `--scope user|project` (default: both, the safer choice — it removes
from every location the CLI recognizes as installed by it) and `--agent` to restrict the
user-scope targets it touches.
