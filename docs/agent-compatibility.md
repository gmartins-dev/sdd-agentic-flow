# Agent compatibility

`sdd-agentic-flow` is designed to remain agent-client agnostic: skills are Markdown-first,
installed locally, and read no vendor-specific API. This matrix separates two different claims:

- **Skill format / scope support**: whether the CLI knows this agent's skill directory
  conventions (see [installation scope](installation-scope.md)). This is mechanically true for the 4
  agents below, since `src/install.ts` writes to them.
- **Manually validated**: whether an actual workflow was manually exercised against that
  agent's harness. Cells marked "not verified" are an honest gap, not a claim.

| Agent/Harness | Skill format | User scope | Project scope | Auto-discovery | Manually validated |
| --- | --- | --- | --- | --- | --- |
| Codex CLI                 | Markdown SKILL.md | `~/.agents/skills/` | `.agents/skills/` (searches parent directories) | Yes (per Codex docs) | Yes                   |
| Claude Code                | Markdown SKILL.md | `~/.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` | Yes (per Claude Code docs) | Yes                 |
| Cursor                     | Markdown SKILL.md | `~/.agents/skills/`, `~/.cursor/skills/` | `.agents/skills/`, `.cursor/skills/` | Yes (per Cursor docs) | Yes                    |
| VS Code + GitHub Copilot   | Markdown SKILL.md | `~/.copilot/skills/` | `.agents/skills/`, `.github/skills/`, `.claude/skills/` | Yes, via `chat.agentSkillsLocations` setting | not verified |
| Generic / other Markdown-first agent | Supported by design | project-local files only | project-local files only | not verified | not verified |

## Cross-agent parity

Skills and toolkit state are **agent-neutral by construction**:

- `.sdd-agentic-flow/config.yml`, `context/project-context.md`, and `autonomy/loop-state.md` contain no vendor-specific fields.
- `.specs/features/` is plain Markdown versioned with your repo.
- Only **install paths** differ per agent (see [installation scope](installation-scope.md)); the installed `SKILL.md` files are identical.

**Mid-flow agent swap** (e.g. start in Cursor, resume in Codex CLI) should work when the agent reads repo files—not chat history:

1. `init` + `install core --scope project` in a test repo.
2. Agent A: produce spec artifacts under `.specs/features/` and record progress in `.sdd-agentic-flow/autonomy/loop-state.md` if using autonomy.
3. End the session.
4. Agent B: read `loop-state.md` and `.specs/`; continue without re-init.
5. Confirm no critical state existed only in Agent A's chat.

This procedure is **manual validation** (two interactive harnesses). The matrix above marks agents not yet manually re-verified after a swap; static audit confirms no architectural blocker.

Compatibility with every agent client is not guaranteed. See
[installation-scope.md](installation-scope.md) for the full directory table, sources, and the
`--agent` flag; see [publishing.md](publishing.md) for when each validation was last performed.

The "Generic / other Markdown-first agent" row's "Supported by design" claim is not incidental.
Every `SKILL.md` this toolkit ships already matches the shape of the open
[Agent Skills Standard](https://agentskills.io/home). See
[inspirations.md](inspirations.md#interoperability-references) for the citation and what this
does and does not claim.
