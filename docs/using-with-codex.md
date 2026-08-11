# Using with Codex CLI

Install a pack, keep `.sdd-agentic-flow/config.yml` in project context, and select a skill explicitly.

```bash
npx sdd-agentic-flow install core
```

`install core` defaults to `--scope user`, writing to `~/.agents/skills/` (Codex CLI's global
skill directory, which it discovers by searching parent directories). Add
`--scope project` to install into `.agents/skills/` inside this repository instead. The
`--agent` flag only changes which global directories `--scope user` writes to. See
[installation scope](installation-scope.md).

```text
Use the installed sdd-create-specs skill to turn this source item into an SDD feature spec.
Follow .sdd-agentic-flow/config.yml. Do not implement code or create commits. Stop if requirements are ambiguous. Report evidence and limitations.
```

Codex remains responsible for requesting authorization before local mutations and must not commit, push, merge, deploy, or publish by default.
