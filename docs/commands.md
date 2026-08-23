# CLI commands reference

Reference for `sdd-agentic-flow` commands. Run `npx sdd-agentic-flow help <command>`
for full usage text.

## Top-level

| Command | Summary |
| --- | --- |
| `(no command)` | Welcome screen with status, policy, installation summary when configured |
| `config installation` | Save installation intent; does not install skills |
| `help [command]` | Command reference |
| `version` | Package version |
| `list` | Available skill packs |

## Setup and configuration

| Command | Summary |
| --- | --- |
| `init` | Create `.sdd-agentic-flow/config.yml` and regenerable toolkit state |
| `init` | Guided 0 → Ready onboarding in a real TTY; explicit flags for automation |
| `config` / `config show` | Read-only operating policy summary |
| `config policy` | Change `execution_mode` and `autonomy_level` |
| `config policy --plan` | Preview policy change; never writes |
| `config policy --yes` | Non-interactive policy mutation (CI-safe with flags) |

## Installation and maintenance

| Command | Summary |
| --- | --- |
| `install <pack>` | Install skills (default user scope, all three targets) |
| `install <pack> --plan` | Installation plan with preflight summary |
| `install <pack> --interactive` | Guided model, targets, preflight, confirm |
| `install <pack> --scope project` | Project install to `.agents/skills/` only |
| `doctor` | Read-only health check |
| `doctor --harness` | Curated repository/project harness-readiness projection |
| `doctor --evidence-graph <slug>` | Read-only v4 requirement traceability graph |
| `doctor --evidence-graph <slug> --html [--output <path>]` | HTML evidence-graph projection; stdout by default, explicit output path to write |
| `upgrade` | Interactive CLI/skill upgrade |
| `uninstall --plan` / `--yes` | Preview or remove installed assets |
| `uninstall --plan --purge` / `--yes --purge` | Cross-scope clean reset |
| `context refresh` | Refresh project context |
| `completion bash\|zsh\|fish` | Print deterministic shell completion |

## Education

| Command | Summary |
| --- | --- |
| `learn-sdd` | One-screen SDD summary + link to [what-is-sdd.md](what-is-sdd.md) |

## Output modes

Behavior follows [cli-interaction.md](cli-interaction.md): human-rich, human-plain, and machine
(`--json`, CI, non-TTY). Exit codes and `--plan` contracts are stable.

## See also

- [Installation scope](installation-scope.md)
- [Configuration](configuration.md)
- [Trust model](trust-model.md)
