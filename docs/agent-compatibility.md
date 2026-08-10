# Agent compatibility

`sdd-agentic-flow` is designed to remain agent-client agnostic: skills are Markdown-first,
installed locally, and read no vendor-specific API. This matrix separates two different claims:

- **Skill format / scope support**: whether the CLI knows this agent's skill directory
  conventions (see [installation scope](installation-scope.md)). This is mechanically true for the 4
  agents below, since `bin/sdd-agentic-flow.js` writes to them.
- **Manually validated**: whether an actual workflow was manually exercised against that
  agent's harness. Cells marked "not verified" are an honest gap, not a claim.

| Agent/Harness | Skill format | User scope | Project scope | Auto-discovery | Manually validated |
| --- | --- | --- | --- | --- | --- |
| Codex CLI                 | Markdown SKILL.md | `~/.agents/skills/` | `.agents/skills/` (searches parent directories) | Yes (per Codex docs) | Yes                   |
| Claude Code                | Markdown SKILL.md | `~/.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | Yes (per Claude Code docs) | Yes                 |
| Cursor                     | Markdown SKILL.md | `~/.agents/skills/`, `~/.cursor/skills/` | `.agents/skills/`, `.cursor/skills/` | Yes (per Cursor docs) | Yes                    |
| VS Code + GitHub Copilot   | Markdown SKILL.md | `~/.copilot/skills/` | `.agents/skills/`, `.github/skills/`, `.claude/skills/` | Yes, via `chat.agentSkillsLocations` setting | not verified |
| Generic / other Markdown-first agent | Supported by design | project-local files only | project-local files only | not verified | not verified |

Compatibility with every agent client is not guaranteed. See
[installation-scope.md](installation-scope.md) for the full directory table, sources, and the
`--agent` flag; see [publishing.md](publishing.md) for when each validation was last performed.

The "Generic / other Markdown-first agent" row's "Supported by design" claim is not incidental.
Every `SKILL.md` this toolkit ships already matches the shape of the open
[Agent Skills Standard](https://agentskills.io/home). See
[inspirations.md](inspirations.md#interoperability-references) for the citation and what this
does and does not claim.
