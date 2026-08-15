# Using with Claude Code

Install a pack, then reference the installed Markdown skill by name.

`install core` defaults to `--scope user` and writes to `~/.claude/skills/<name>/SKILL.md`
(Claude Code's global skill directory). Pass `--scope project` to install into
`.agents/skills/` inside this repository instead. See
[installation scope](installation-scope.md).

```text
Use the installed saf-implement skill for this approved task. Follow .sdd-agentic-flow/config.yml and the task acceptance criteria. Modify local files only when authorized. Do not commit, push, merge, deploy, or publish.
```

Review the resulting evidence with `saf-check-task` and `saf-validate` before accepting the work. Use `saf-release` on demand when you need a release-readiness check before tagging.
