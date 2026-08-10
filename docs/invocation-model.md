# Invocation model

The toolkit is agent-client agnostic. This taxonomy guides people and agents. It does not automatically activate skills.

## User-invoked orchestrators

- `setup-sdd-agentic-flow`
- `sdd-route`
- `sdd-brainstorm`
- `sdd-create-specs`
- `sdd-explain-me`
- `sdd-create-prompts`
- `sdd-implement-task`
- `sdd-implement-multi`
- `sdd-create-pr`
- `sdd-validation`
- `sdd-release` (on demand, after validation when tagging or publishing)

## Agent-assisted review discipline

- `sdd-task-check`
- `sdd-pr-review`
- `sdd-pr-fix`

Invoke `sdd-route` when the next step is uncertain. Read the recommended skill's local `SKILL.md` as the source of truth. See the [skills catalog](skills-catalog.md) for all 14 public skills.
