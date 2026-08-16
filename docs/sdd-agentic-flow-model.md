# sdd-agentic-flow mental model

One-page map of how this toolkit fits together. Commands, paths, and skill names stay in English.

## Positioning

**sdd-agentic-flow** is a spec-driven **agent harness**: Markdown skills, local CLI, evidence-first gates—not an agent runtime or scheduler. Skills are the **execution layer**, not the whole harness. The **workflow contract is portable** across capable agents; this toolkit does not copy an IDE/CLI/sub-agent runtime (Kiro is adjacent market evidence, not a product to clone).

> Prompts tell AI what to do. Context tells it what to know. Harnesses tell it how to operate. Loops help it finish. **SDD tells it what "done" means.**

## Four layers + SDD

| Layer | Question it answers | Where it lives |
| --- | --- | --- |
| **Prompt** | What should the agent do next? | Skill `SKILL.md` bodies, task prompts from `saf-create-prompts` |
| **Context** | What does the project already know? | Packages under `.specs/features/` (resolve one, then load narrowly), `.sdd-agentic-flow/context/`, `.sdd-agentic-flow/config.yml` |
| **Harness** | How may the agent operate safely? | `execution_mode`, safety defaults, capability contracts, evidence standard |
| **Loop** | How does work continue across steps/sessions? | `autonomy_level`, 7 guardrails, `.sdd-agentic-flow/autonomy/loop-state.md`, handoffs |

**SDD (Spec-Driven Development)** is the completion contract: behavior, scope, and acceptance criteria are written in `.specs/features/` before production code changes. Sensors produce evidence. Validation and release skills evaluate that evidence against the contract—not chat confidence. A passing sensor is not a correctness verdict; the human remains the gate. The [evidence standard](../shared/references/evidence-standard.md) names false-positive classes and an evidence strength ladder so self-report and ungrounded agent tests cannot outrank spec and contracts.

## Instruction precedence

When texts conflict, this order wins (no extra doc):

1. Toolkit safety (`no_commit` / `no_push` / no publish / untrusted input)
2. Explicit human instruction in the current request
3. Active SDD package (resolve one; spec over lifecycle metadata)
4. Condensed methodology (tlc, tdd, evidence, lifecycle, work-types, profiles)
5. Engineering principles (how to change code; never flips PASS)
6. Skill Workflow / Safety (operational; must not contradict 1–5)
7. Agent / model defaults

`config.yml` parametrizes execution and autonomy **inside** (1). No configuration value
overrides safety. Skill Workflow does not outrank the methodology.

**Graph** is not a fifth runtime layer. Workflow rails already live in `saf-route` (skills are selected, not chained automatically) plus the optional `REQ-{id}` convention in artifact contracts. `doctor --evidence-graph` is a watched direction, not a current command.

## What controls what

| Control | Artifact / CLI | Governs |
| --- | --- | --- |
| Operating preset | `init --preset` (UX) | Writes the two fields below; not a third stored axis |
| `execution_mode` | `.sdd-agentic-flow/config.yml` | What a skill may do (plan / guided / apply / review / full) |
| `autonomy_level` | same config | Whether the next skill needs a human between steps |
| `autonomy_budget` | same config | Iteration/token/runtime limits (guardrail 6) |
| Capability contract | each `SKILL.md` frontmatter | Inputs, outputs, baselines, `autonomy_profile` |
| Guardrails 1–7 | `shared/references/autonomy-guardrails.md` | When `autonomous` may auto-advance |
| Loop state | `.sdd-agentic-flow/autonomy/loop-state.md` | Resume point, overrides, last skill status |
| Evidence | check/validation reports, `Status:` field | Whether "done" is believable |
| Routing | `saf-route` + `workflow-routing.md` | Which skill is on-path |
| Doctor | `sdd-agentic-flow doctor` | Static validation of config, skills, autonomy setup |

Specs (`.specs/features/`) belong to **your project**. Toolkit state (`.sdd-agentic-flow/`) belongs to **this installation** and is regenerable except hand-edited config.

## Glossary (12 terms)

The [canonical vocabulary](../shared/references/canonical-vocabulary.md) defines the broader
Intent → Capability → Execution → Control → Verification taxonomy. The glossary below keeps the
terms most useful when operating this toolkit.

| Term | Meaning |
| --- | --- |
| **Skill** | Markdown contract (`SKILL.md`) the agent reads and follows |
| **Capability contract** | Frontmatter fields (`requires`, `consumes`, `produces`, …) linking skills |
| **Feature profile** | Uncertainty/risk sizing hint (`small_fix` … `epic`) in config; independent of inferred work intent |
| **Execution mode** | Authorization axis: what work type is allowed |
| **Autonomy level** | Advance axis: manual / supervised / autonomous |
| **Guardrail** | Deterministic gate before auto-advancing to the next skill |
| **Loop state** | Append-only execution memory for supervised/autonomous runs |
| **Evidence** | Sensor results + `Status:` establishing confidence about specified properties |
| **Handoff** | Cross-session bridge when a skill spans agent boundaries |
| **Golden flow** | Fixture + walkthrough + `test/cli.test.ts` integration proof |
| **Doctor** | Local validator; never invokes skills or runs your tests |
| **Golden flow ID** | e.g. `AUTO-001` — autonomy chain proofs in this repository |

## Related docs

- [SDD methodology](sdd-methodology.md) — phase table and flow
- [Architecture](architecture.md) — layers and file layout
- [Autonomy levels](autonomy-levels.md) · [Autonomy guardrails](autonomy-guardrails.md)
- [v2 breaking changes](v2-breaking-changes.md) — what 2.0 removes; leftover `.sdd/` is a manual rename
