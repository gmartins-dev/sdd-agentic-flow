# Invocation model

The toolkit is agent-client agnostic. This taxonomy is guidance for people and agents; it does not automatically activate skills.

## User-invoked orchestrators

- `setup-sdd-agentic-flow`
- `sdd-route`
- `sdd-create-specs`
- `sdd-create-prompts`
- `sdd-implement-task`
- `sdd-implement-multi`
- `sdd-create-pr`
- `sdd-validation`

## Agent-assisted review discipline

- `sdd-task-check`
- `sdd-pr-review`
- `sdd-pr-fix`

Use `sdd-route` to recommend a next step when uncertain, then read the recommended skill's local `SKILL.md` as the source of truth.
