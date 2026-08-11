# sdd-agentic-flow mental model

One-page map of how this toolkit fits together. Commands, paths, and skill names stay in English.

## Positioning

**sdd-agentic-flow** is a spec-driven **agent harness**: Markdown skills, local CLI, evidence-first gates—not an agent runtime or scheduler.

> Prompts tell AI what to do. Context tells it what to know. Harnesses tell it how to operate. Loops help it finish. **SDD tells it what "done" means.**

## Four layers + SDD

| Layer | Question it answers | Where it lives |
| --- | --- | --- |
| **Prompt** | What should the agent do next? | Skill `SKILL.md` bodies, task prompts from `sdd-create-prompts` |
| **Context** | What does the project already know? | `.specs/features/`, `.sdd-agentic-flow/context/`, `.sdd-agentic-flow/config.yml` |
| **Harness** | How may the agent operate safely? | `execution_mode`, safety defaults, capability contracts, evidence standard |
| **Loop** | How does work continue across steps/sessions? | `autonomy_level`, 7 guardrails, `.sdd-agentic-flow/autonomy/loop-state.md`, handoffs |

**SDD (Spec-Driven Development)** is the completion contract: behavior, scope, and acceptance criteria are written in `.specs/features/` before production code changes. Validation and release skills check evidence against that contract—not chat confidence.

## What controls what

| Control | Artifact / CLI | Governs |
| --- | --- | --- |
| `execution_mode` | `.sdd-agentic-flow/config.yml` | What a skill may do (plan / guided / apply / review / full) |
| `autonomy_level` | same config | Whether the next skill needs a human between steps |
| `autonomy_budget` | same config | Iteration/token/runtime limits (guardrail 6) |
| Capability contract | each `SKILL.md` frontmatter | Inputs, outputs, baselines, `autonomy_profile` |
| Guardrails 1–7 | `shared/references/autonomy-guardrails.md` | When `autonomous` may auto-advance |
| Loop state | `.sdd-agentic-flow/autonomy/loop-state.md` | Resume point, overrides, last skill status |
| Evidence | check/validation reports, `Status:` field | Whether "done" is believable |
| Routing | `sdd-route` + `workflow-routing.md` | Which skill is on-path |
| Doctor | `sdd-agentic-flow doctor` | Static validation of config, skills, autonomy setup |
| Migrate | `sdd-agentic-flow migrate --apply` | Move legacy `.sdd/` → `.sdd-agentic-flow/` |

Specs (`.specs/features/`) belong to **your project**. Toolkit state (`.sdd-agentic-flow/`) belongs to **this installation** and is regenerable except hand-edited config.

## Glossary (12 terms)

| Term | Meaning |
| --- | --- |
| **Skill** | Markdown contract (`SKILL.md`) the agent reads and follows |
| **Capability contract** | Frontmatter fields (`requires`, `consumes`, `produces`, …) linking skills |
| **Feature profile** | Sizing hint (`small_fix` … `epic`) in config |
| **Execution mode** | Authorization axis: what work type is allowed |
| **Autonomy level** | Advance axis: manual / supervised / autonomous |
| **Guardrail** | Deterministic gate before auto-advancing to the next skill |
| **Loop state** | Append-only execution memory for supervised/autonomous runs |
| **Evidence** | Artifacts + `Status:` proving a step actually completed |
| **Handoff** | Cross-session bridge when a skill spans agent boundaries |
| **Golden flow** | Fixture + walkthrough + `test/cli.test.js` integration proof |
| **Doctor** | Local validator; never invokes skills or runs your tests |
| **Golden flow ID** | e.g. `AUTO-001` — autonomy chain proofs in this repository |

## Related docs

- [SDD methodology](sdd-methodology.md) — phase table and flow
- [Architecture](architecture.md) — layers and file layout
- [Autonomy levels](autonomy-levels.md) · [Autonomy guardrails](autonomy-guardrails.md)
- [Upgrading](upgrading.md) — migrating from legacy `.sdd/`
