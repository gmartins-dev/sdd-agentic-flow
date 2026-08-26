# Compatibility matrix

The official bundle is the complete locked roster in `OFFICIAL_SKILLS`. Every
supported target receives the same 12 skills and shared layer.

| Target | User scope | Project scope |
| --- | --- | --- |
| Agents/Codex | `~/.agents/skills/` | `.agents/skills/` |
| Cursor | `~/.agents/skills/`, `~/.cursor/skills/` | `.agents/skills/` |
| Claude Code | `~/.claude/skills/` | `.agents/skills/` |
| VS Code/Copilot | `~/.copilot/skills/` | `.agents/skills/` |

Capability compatibility is validated through each skill's portable
frontmatter and `saf-contract.yml`. The CLI does not require a provider API,
persist credentials, or create an agent runtime.
