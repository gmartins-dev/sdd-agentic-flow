# Autonomy levels

`workflow.autonomy_level` in optional `.sdd-agentic-flow/config.yml` is an axis orthogonal to
[execution modes](execution-modes.md) (`plan`/`guided`/`apply`/`review`/`full`). It does not
replace or duplicate them. `execution_mode` answers "what is a skill authorized to do";
`autonomy_level` answers "does a skill need a human between it and the next one." The default,
`supervised`, pairs with `apply` in the built-in effective policy.

## The three levels

| Level | What happens after a skill completes | Transition policy |
| --- | --- | --- |
| `manual` | Returns control completely. Nothing advances automatically. | `stop` |
| `supervised` (default) | Reports evidence and asks "continue to `<next skill>`?"; a human decides. | `confirm` |
| `autonomous` | Owns local progression, repair, and validation until verified completion within delegated authority. | `continue`, bounded by recovery |

**Autonomous does not mean unlimited authority.** The agent resolves ordinary failures, repair
cycles, and evidence-backed technical ambiguity before escalating. Human intervention remains
required for safety, external or irreversible authority, underdetermined intent, delegated-goal
expansion, exhaustion, no meaningful progress, or explicit override. Commit, push, merge, tag, and
publish stay outside the delegation.

Missing configuration uses `apply + supervised`. Use `config policy` to persist
a different pair. The 5×3 matrix remains available for explicit policy.

## `execution_mode` × `autonomy_level` compatibility

| execution_mode | `manual` | `supervised` | `autonomous` |
| --- | --- | --- | --- |
| `plan` | valid (default) | valid, uncommon | **invalid** |
| `guided` | valid | valid (default) | **invalid** |
| `apply` | valid | valid | valid (default) |
| `review` | valid (default) | valid | valid, uncommon |
| `full` | valid | valid | valid (default) |

`plan` and `guided` never combine with `autonomous`: a plan-only workflow has nothing to
auto-advance into, and step-by-step confirmation is the entire point of `guided`.
`doctor --autonomy` flags either combination as `FAIL`; `config policy` rejects
it before writing `.sdd-agentic-flow/config.yml`.

## Capability / gate matrix (across presets)

| Action | manual | supervised | autonomous |
| --- | --- | --- | --- |
| Read repository | yes | yes | yes |
| Create/update SDD artifacts | yes | yes | yes |
| Implement code | per `execution_mode` | yes (`apply`) | yes (`full`) |
| Run tests / sensors | yes | yes | yes |
| Task check / feature validation | yes | yes | yes |
| Local PR **package** (`saf-create-pr`) | yes | yes | yes |
| Open GitHub/Git PR, commit, push | **human** | **human** | **human** |
| Tag / npm publish / deploy | **human** | **human** | **human** |
| Advance or repair without asking | no | confirm | yes, when the transition is admissible and bounded |

## The 7 guardrails

See [autonomy guardrails](autonomy-guardrails.md) for the full definition of each one
(completion status, evidence validation, verification gates, scope boundary, transition validity,
resource sufficiency, human override). That page covers the one part of the model with enough
surface area to warrant its own page.

## Configuration

```yaml
workflow:
  execution_mode: apply # plan, guided, apply, review, full — default: apply
  autonomy_level: supervised # manual, supervised, autonomous — default: supervised

  autonomy_budget:
    max_iterations: 50
    max_tokens: 500000
    max_runtime_hours: 4
    pause_on_warning: true # stop, not just warn, once budget drops below ~20%
```

Use `config policy` to persist this pair. An absent config is healthy and
resolves to `apply + supervised`. An incomplete or invalid config fails closed.
See [configuration](configuration.md).

`workflow.skill_overrides` (optional, not written by `init`) pins one skill to a stricter level
regardless of the workflow default. For example, keep `saf-review-pr` at `manual` even inside an
otherwise `autonomous` run, because a security-sensitive review should always get a human look:

```yaml
workflow:
  skill_overrides:
    saf-review-pr:
      autonomy_level: manual
```

## CLI surface

- `config policy`: preview or persist an explicit policy override.
- `doctor --autonomy [--verbose]`: validate `workflow.execution_mode`/`autonomy_level`, the
  compatibility matrix, every installed skill's `autonomy_profile` support for the configured
  level, `workflow.autonomy_budget`, and the last recorded loop state. `--verbose` also lists all
  7 guardrails and what each one gates.
- `context autonomy-state`: read-only report of the current configuration and the last recorded
  `.sdd-agentic-flow/autonomy/loop-state.md`, the execution-state file an agent maintains while running a
  `supervised`/`autonomous` workflow.
- `autonomous-resume [--force] [--override-guard=<1-7> --reason="..."]`: clear a `pause=true`/
  `stop=true` recorded in `loop-state.md` and append an audited log entry, so the invoking agent
  can re-check guardrails and continue.

None of these commands run a skill or an orchestration loop themselves. This package ships
skills for an agent to read and follow, not a runtime that executes them. `autonomy_level` is a
contract the skills and the invoking agent honor. The CLI validates that contract
statically (`doctor --autonomy`) and manages the state file agents read and write while honoring
it (`context autonomy-state`, `autonomous-resume`). See the "Scope" section of
[autonomy guardrails](autonomy-guardrails.md).

## Authoring `autonomy_profile` for a skill

Each skill declares, in its `SKILL.md` frontmatter:

```yaml
autonomy_profile:
  supported_levels: [manual, supervised, autonomous]
  auto_continue_condition: 'spec.md and design.md present with no unresolved Unknown finding'
  blocking_conditions: [missing_spec, inconsistent_design, unspecified_requirements]
  evidence_required: [spec.md, design.md]
```

- `supported_levels`: a skill whose output is always a recommendation or explanation for a human
  to act on, never itself a link in the autonomous chain (`saf-brainstorm`, `saf-explain`,
  human-judgment capabilities), omits `autonomous`. `saf-route` remains read-only but may provide the next
  autonomous intake recommendation.
- `auto_continue_condition`: one human-readable line describing "safe to advance automatically"
  for this skill. Informational; the actual gate is guardrails 1–3.
- `blocking_conditions` / `evidence_required`: the specific failure modes and required artifacts
  a skill (and the agent invoking it) checks against when deciding `PASS`/`FAIL` and whether to
  advance. `scripts/check-skills.sh` only checks that these two fields are *present*, not their
  content; `doctor --autonomy` does not currently read them at all. It validates
  `supported_levels`, not evidence on disk. Runtime evidence validation is the invoking agent's
  responsibility, consistent with this CLI hosting no orchestration engine (see "CLI surface"
  above).

`scripts/check-skills.sh` fails if a skill is missing `autonomy_profile`, or if
`supported_levels` contains anything outside `{manual, supervised, autonomous}`.

## MCP and tool use

`autonomy_level` governs skill-to-skill transitions only. A skill running at `autonomy_level:
manual` may still call any tool it always could, including an available MCP integration, exactly
as before. Autonomy only changes whether the agent asks before invoking the *next skill*. MCP
stays awareness, not a platform: optional host integrations may consume local SAF artifacts, but
the core package hosts no MCP server and does not require a provider adapter.

## What this does not promise

`autonomous` is not unrestricted authority, not permission to commit/push/release, and not a CLI
orchestration engine. The CLI validates policy and loop state; it never invokes skills or runs
workflows for you.

Same posture as [what this does not promise](compatibility-promise.md#what-this-does-not-promise):
`autonomous` is not a guarantee of correctness, permission to perform external actions, or a
claim that a workflow can ignore safety and budgets. It is a mechanical, auditable rule for when a
human is asked versus when bounded repair continues under the documented contracts.
