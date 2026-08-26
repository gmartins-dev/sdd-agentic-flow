# Using with Cursor

Install the official bundle and let Cursor read its skills. Project config is optional.

`install` defaults to `--scope user` and writes to `~/.agents/skills/` and
`~/.cursor/skills/` (Cursor's global skill directories). Pass `--scope project` to install into
`.agents/skills/` inside this repository instead. See
[installation scope](installation-scope.md).

```text
Use the installed saf-check-task skill to independently check this completed task. Follow .sdd-agentic-flow/config.yml. Do not modify files. Return findings and evidence only.
```

Keep configuration and skill files under project context. Cursor integrations are optional; this package does not require them.
