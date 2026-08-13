# Invocation model

The toolkit is agent-client agnostic. This taxonomy guides people and agents. It is an
**invocation policy**, not a runtime: the CLI never authors SDD artifacts and never runs a
skill loop.

The **canonical workflow path** is Plan → Prompt → Implement → Check → PR → Review → Fix →
Validate; Release on demand. Invoke `sdd-route` when the next step is uncertain. Read the
recommended skill's local `SKILL.md` as the source of truth.

Operating presets (`init --preset`) write `execution_mode` and `autonomy_level` only:

| Preset | Writes | Invocation policy |
| --- | --- | --- |
| `manual` (default) | `guided` + `manual` | Stop after each skill |
| `supervised` | `apply` + `supervised` | Propose next skill; human confirms |
| `autonomous` | `full` + `autonomous` | Same session may follow the next on-path `SKILL.md` while all 7 guardrails pass |

Autonomous does not mean unattended. If the preset is `autonomous` and the guardrails pass,
the **invoking agent** may read each next on-path `SKILL.md` in order. The CLI still does
not invoke skills. Commit, push, merge, tag, and publish stay human on every preset.

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
