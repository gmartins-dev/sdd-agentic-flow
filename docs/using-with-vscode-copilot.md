# Using with VS Code + GitHub Copilot

Install a pack, then reference the installed Markdown skill by name in a Copilot Chat prompt.

```bash
npx sdd-agentic-flow install full
```

`install full` defaults to `--scope user`, writing to `~/.copilot/skills/` (GitHub Copilot's
global skill directory). Add `--scope project` to install into `.agents/skills/` inside this
repository instead. VS Code can also be pointed at a custom skills location via the
`chat.agentSkillsLocations` setting. See [installation scope](installation-scope.md).

```text
Use the installed saf-check-task skill to independently check this completed task. Follow .sdd-agentic-flow/config.yml. Do not modify files. Return findings and evidence only.
```

Manual validation against VS Code + GitHub Copilot has not been performed yet. See
[agent compatibility](agent-compatibility.md) for the honest status of this cell.
