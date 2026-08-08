# Using with Claude Code

Install a pack, then reference the installed Markdown skill by name.

`install core` defaults to `--scope user`, writing to `~/.claude/skills/<name>/SKILL.md`
(Claude Code's global skill directory). Add `--scope project` to install into
`.agents/skills/` inside this repository instead. See
[installation scope](installation-scope.md).

```text
Use the installed sdd-implement-task skill for this approved task. Follow .sdd/config.yml and the task acceptance criteria. Modify local files only when authorized. Do not commit, push, merge, deploy, or publish.
```

Review the resulting evidence with `sdd-validation` before accepting the work.
