# Using with Cursor

Install a pack and let Cursor read the skill and `.sdd/config.yml` files.

`install core` defaults to `--scope user`, writing to `~/.agents/skills/` and
`~/.cursor/skills/` (Cursor's global skill directories). Add `--scope project` to install into
`.agents/skills/` inside this repository instead. See
[installation scope](installation-scope.md).

```text
Use the installed sdd-task-check skill to independently check this completed task. Follow .sdd/config.yml. Do not modify files. Return findings and evidence only.
```

Keep configuration and skill files under project context; do not treat Cursor integrations as a requirement of this package.
