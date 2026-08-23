# Invocation model

The toolkit is agent-client agnostic. This taxonomy guides people and agents. It is an
**invocation policy**, not a runtime: the CLI never authors SDD artifacts and never runs a
skill loop.

The **canonical workflow path** is Plan → Prompt → Implement → Check → PR → Review → Fix →
Validate. Invoke `saf-route` when the next step is uncertain. Read the
recommended skill's local `SKILL.md` as the source of truth.

Operating presets (`init --preset`) write `execution_mode` and `autonomy_level` only:

| Preset | Writes | Invocation policy |
| --- | --- | --- |
| `manual` (default) | `guided` + `manual` | Stop after each skill |
| `supervised` | `apply` + `supervised` | Propose next skill; human confirms |
| `autonomous` | `full` + `autonomous` | Same session may follow the next on-path `SKILL.md` for admissible normal or repair transitions while the seven guardrails remain satisfied |

Autonomous does not mean unlimited authority. If the preset is `autonomous`, the **invoking
agent** may read the next on-path `SKILL.md` for a normal or authorized repair transition when
the guardrails admit that transition. A recoverable negative result may route to its owning
repair Skill; exceptional authority, safety, budget, no-progress, or human-override conditions
return control to a human. The CLI still does not invoke Skills. Commit, push, merge, tag, and
publish stay human on every preset.

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

## Agent-assisted review discipline

- `saf-check-task`
- `saf-review-pr`
- `saf-fix-pr`

Invoke `saf-route` when the next step is uncertain. Read the recommended skill's local `SKILL.md` as the source of truth. See the [skills catalog](skills-catalog.md) for all 13 public skills.
