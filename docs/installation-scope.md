# Installation scope

`install` supports two explicit scopes. `user` is the default: it never touches the
consumer project. `project` is opt-in and matches the toolkit's pre-v0.9.0 behavior.

| Scope | What `install <pack>` does | Trace in the project |
| --- | --- | --- |
| `user` (default) | Copies skills into the global skill directories of each supported agent | None. No file or directory is created in `cwd` |
| `project` (opt-in) | Copies skills into `.agents/skills/` inside the project, same as `install` before v0.9.0 | Real files, appear as untracked in `git status`; the team decides whether to commit |

```bash
npx sdd-agentic-flow install core                       # scope: user (default), zero footprint
npx sdd-agentic-flow install core --scope project        # writes .agents/skills/ in the project
npx sdd-agentic-flow install core --plan                 # dry run: show what would be written, touch nothing
```

## Ownership boundary

The scope only applies to what `install` copies (skills). It never applies to `.sdd-agentic-flow/config.yml`
or `.sdd-agentic-flow/context/project-context.md`, which are project policy, always created by
`init`/`context refresh`, and always live in the project regardless of scope.

| Category | Lives in | Owner |
| --- | --- | --- |
| Installed skills                   | user-local (default) / project (opt-in) | user / team  |
| CLI installation config            | user-local                             | user         |
| `.sdd-agentic-flow/config.yml` (project policy) | project                                | team         |
| `.sdd-agentic-flow/context/project-context.md`  | project                                | team         |
| `.sdd-agentic-flow/usage.md` (regenerable stub) | project                                | toolkit      |
| `.sdd-agentic-flow/saf-skills-usage-guide.md` or `.pt-BR.md` (active locale copy) | project | toolkit      |
| `.sdd-agentic-flow/explanations/*.md` (on-demand) | project                              | toolkit      |
| `.specs/features/**`               | project                                | team         |

`init` and `install` are different commands:

| Command | Writes in the project | Typical git status |
| --- | --- | --- |
| `init` | `.sdd-agentic-flow/` (config, context, usage stub, snapshots, reports) and `.specs/features/` | Untracked until the team decides what to commit |
| `install --scope user` (default) | Nothing | Unchanged |
| `install --scope project` | `.agents/skills/` | Untracked skill files |

`.specs/features/` is project work and should normally be versioned. This toolkit repository gitignores `.specs/` for local dogfooding only — that exception is not the consumer default. `.sdd-agentic-flow/config.yml` is project policy; teams that want shared defaults commit it. `usage.md` is regenerable — re-run `init` to refresh it.

## Local git exclude (user scope)

When the saved installation intent uses `scope: user` (the default), `init` automatically
appends `.sdd-agentic-flow/` to `.git/info/exclude` in a Git repository (idempotent). That hides
toolkit state from `git status` **without** editing the team's `.gitignore`. It does **not**
exclude `.specs/`. Pass `init --local-git-exclude` explicitly when using `scope: project` but
still wanting toolkit state hidden locally.

If Git is absent, the command continues with a `WARN`. The CLI never auto-edits `.gitignore`.

## Agent Integration Layer

`sdd-agentic-flow` supports 4 agents officially. Each global (`user` scope) directory is
verified against that agent's own documentation:

| Agent | Global (`user` scope) | Project (`project` scope) | Source |
| --- | --- | --- | --- |
| Codex CLI                | `$HOME/.agents/skills/`                      | `.agents/skills/`             | [developers.openai.com/codex](https://learn.chatgpt.com/docs/build-skills)                          |
| Cursor                   | `~/.agents/skills/` and `~/.cursor/skills/`  | `.agents/skills/` and `.cursor/skills/` | [cursor.com/help/customization/skills](https://cursor.com/help/customization/skills)                |
| Claude Code               | `~/.claude/skills/<name>/SKILL.md`           | `.claude/skills/<name>/SKILL.md` | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills)                            |
| VS Code + GitHub Copilot  | `~/.copilot/skills/`                         | `.agents/skills/`, `.github/skills/`, `.claude/skills/` | [code.visualstudio.com/docs/agent-customization/agent-skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) |

Targets are selected by the canonical installation configuration. Use
`config installation --plan` to preview the exact paths before writing; no agent-specific
flag is required.

## `--plan`

`install <pack> --plan` is a dry run: it prints an **installation plan** (mode, scope,
targets, repository changes, preflight counts) without touching anything. In `user` scope
it reports `Repository changes: none`; in `project` scope it lists Git-visible paths under
`.agents/skills/`. Mutating install with preflight **COLLISION** > 0 exits non-zero.

Use `install <pack> --interactive` for a guided wizard (model, targets, preflight summary,
confirm). Non-interactive `install core` remains the default backward-compatible path.

## UX labels (v3.0.0)

| UX label | CLI | Footprint |
| --- | --- | --- |
| **Local / User** | `--scope user` (default) | No files in the project |
| **Project / Team — Shared** | `--scope project` | `.agents/skills/` (Git-visible) |

Project scope still writes **only** `.agents/skills/` in v3.0.0 — not multi-path selection.

## `doctor`

`doctor` reports an "Installation" section: whether a valid installation exists at the
project target and at each of the 3 default user-scope targets, plus an explicit
`✓ No project files created by installation` line when scope `user` left the project untouched.

## `uninstall --scope`

`uninstall --plan` previews cleanup and `uninstall --yes` applies it. Only known toolkit-managed
files are removed; user files and project specs are preserved.
