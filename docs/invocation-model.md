# Invocation model

The toolkit is agent-client agnostic. This taxonomy guides people and agents. It is an
**invocation policy**, not a runtime: the CLI never authors SDD artifacts and never runs a
skill loop.

The **canonical workflow path** is Plan → Prompt → Implement → Check → PR → Review → Fix →
Validate; Release on demand. Invoke `saf-route` when the next step is uncertain. Read the
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

- `saf-setup`
- `saf-route`
- `saf-brainstorm`
- `saf-create-spec`
- `saf-explain`
- `saf-create-prompts`
- `saf-implement`
- `saf-implement-multi`
- `saf-create-pr`
- `saf-validate`
- `saf-release` (on demand, after validation when tagging or publishing)

## Agent-assisted review discipline

- `saf-check-task`
- `saf-review-pr`
- `saf-fix-pr`

Invoke `saf-route` when the next step is uncertain. Read the recommended skill's local `SKILL.md` as the source of truth. See the [skills catalog](skills-catalog.md) for all 14 public skills.
