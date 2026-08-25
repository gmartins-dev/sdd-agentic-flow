# Installation scope

`install` supports two explicit skill scopes. `user` is the default: it never installs skills in
the consumer project. `project` is opt-in and writes the official project skill directory.
Project adoption is a separate choice and does not redefine `scope`.

| Scope | What `install <pack>` does | Trace in the project |
| --- | --- | --- |
| `user` (default) | Copies skills into the global skill directories of each supported agent | None from skill installation |
| `project` (opt-in) | Copies official SAF skills into `.agents/skills/` inside the project | SAF-owned files can be shared; foreign skills remain untouched |

```bash
npx sdd-agentic-flow install full                       # scope: user (default), zero footprint
npx sdd-agentic-flow install full --scope project        # writes .agents/skills/ in the project
npx sdd-agentic-flow install full --plan                 # dry run: show what would be written, touch nothing
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
| `init` | `.sdd-agentic-flow/` (config, context, usage stub, snapshots, reports) and `.specs/features/` | Visibility follows the selected adoption preset |
| `install --scope user` (default) | Nothing | Unchanged |
| `install --scope project` | `.agents/skills/` | Untracked skill files |

`.specs/features/` is project work and should normally be versioned. This toolkit repository gitignores `.specs/` for local dogfooding only — that exception is not the consumer default. `.sdd-agentic-flow/config.yml` is project policy; teams that want shared defaults commit it. `usage.md` is regenerable — re-run `init` to refresh it.

## Adoption presets and local Git excludes

Guided setup asks how SAF will be used: **Personal**, **Specs shared**, or **Team**. Personal
manages separate SAF blocks for `.sdd-agentic-flow/` and the exact `specs.root`. Specs shared
manages only the local SAF state block. Team manages only explicitly listed derived paths, such
as `context/project-context.md`, reports, snapshots, autonomy state, explanations, and generated
usage guides. Team leaves `config.yml`, `context/domain-glossary.md`, official skills, and
`sdd-agentic-flow-shared` visible.

SAF preserves foreign `info/exclude` lines, `.gitignore`, and global excludes. It never hides the
whole `.agents/skills/` directory or foreign skills. Tracked files remain tracked in every
preset. Missing or malformed Git metadata is a non-fatal warning.

Existing 6.4.x installations without `adoption_mode` are unclassified. Their current visibility
is preserved until you explicitly choose a preset or **Keep current visibility**.

If Git is absent, the command continues with a `WARN`. The CLI never auto-edits `.gitignore`.

## Agent Integration Layer

`sdd-agentic-flow` supports 4 agents officially. Each global (`user` scope) directory is
verified against that agent's own documentation:

| Agent | Global (`user` scope) | Project (`project` scope) | Source |
| --- | --- | --- | --- |
| Codex CLI | `$HOME/.agents/skills/` | `.agents/skills/` | [developers.openai.com/codex](https://learn.chatgpt.com/docs/build-skills) |
| Cursor | `~/.agents/skills/` and `~/.cursor/skills/` | `.agents/skills/` | [cursor.com/help/customization/skills](https://cursor.com/help/customization/skills) |
| Claude Code | `~/.claude/skills/<name>/SKILL.md` | `.agents/skills/` | [code.claude.com/docs/en/skills](https://code.claude.com/docs/en/skills) |
| VS Code + GitHub Copilot | `~/.copilot/skills/` | `.agents/skills/` | [code.visualstudio.com/docs/agent-customization/agent-skills](https://code.visualstudio.com/docs/agent-customization/agent-skills) |

Targets are selected by the canonical installation configuration. Use
`config installation --plan` to preview the exact paths before writing; no agent-specific
flag is required.

## `--plan`

`install <pack> --plan` is a dry run: it prints an **installation plan** (mode, scope,
targets, repository changes, preflight counts) without touching anything. In `user` scope
it reports `Repository changes: none`; in `project` scope it lists Git-visible paths under
`.agents/skills/`. Mutating install with preflight **COLLISION** > 0 exits non-zero.

Use `install <pack> --interactive` for a guided wizard (model, targets, preflight summary,
confirm). A clean-slate upgrade replaces SAF-managed installation state with the current
contract; it does not migrate obsolete packs or configuration.

## UX labels

| UX label | CLI | Footprint |
| --- | --- | --- |
| **User skills** | `--scope user` (default) | No files from skill installation |
| **Project skills** | `--scope project` | Official `.agents/skills/` files |

Project scope writes only `.agents/skills/`. Agent-specific project directories are not
selected by this scope.

## `doctor`

`doctor` reports an "Installation" section: whether a valid installation exists at the
project target and at each of the 3 default user-scope targets, plus an explicit
`✓ No project files created by installation` line when scope `user` left the project untouched.

## `uninstall --scope`

`uninstall --plan` previews cleanup and `uninstall --yes` applies it. Only known toolkit-managed
files are removed; user files and project specs are preserved.
