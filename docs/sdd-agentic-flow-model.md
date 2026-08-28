# sdd-agentic-flow mental model

One-page map of how this toolkit fits together. Commands, paths, and skill names stay in English.

## Positioning

**sdd-agentic-flow** is a **Spec-Driven Agentic Workflow Harness** and repository-native **engineering control plane for
Spec-Driven coding-agent workflows**: Markdown skills, local CLI, and
evidence-first gates—not an agent runtime or scheduler. Skills are
capabilities; host workers and loops are execution mechanics.

The short public category is **Agentic Workflow Harness**; the explicit target form is
**Spec-Driven Coding-Agent Workflow Harness**. Read the [developer journey](developer-journey.md)
for an illustrative lifecycle.

> The model proposes. The host executes. SAF defines constraints and admissible
> transitions. Sensors observe. Evidence records. Verification evaluates.
> Humans govern.

## Canonical architecture

```text
Intent → Specification → Bounded work → Policy/gates → Admissible action
                                                   ↓
                                      Host/human chooses execution
                                                   ↓
                                      Tools/environment → Sensors → Evidence
                                                                      ↙       ↘
                                                           Verification   Evidence Graph
                                                                            (projection)
```

| Graph | Owner | Question it answers |
| --- | --- | --- |
| Dependency graph | SAF tasks DAG | What can run in parallel? |
| Execution graph | Host | Who executes the next turn or worker? |
| Evidence graph | SAF projection | Why is REQ-X believed satisfied? |

**SDD (Spec-Driven Development)** is the completion contract: behavior, scope, and acceptance criteria are written in `.specs/features/` before production code changes. Loop, sessions, and subagents are host execution strategies, not SAF layers. Evidence Graph is a read-only traceability projection, never an orchestration graph or verification authority. A passing sensor is not a correctness verdict; the human remains the gate.

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

**Graph** is not a fifth runtime layer. Workflow rails live in `saf-route` (skills are selected,
not chained automatically) plus the v4 `REQ-*` traceability contract in
[artifact-contracts.md](../shared/references/artifact-contracts.md). `doctor --evidence-graph`
is a read-only inspection command over `.sdd-agentic-flow/reports`; it does not mutate artifacts
or run agents.

## What controls what

| Control | Artifact / CLI | Governs |
| --- | --- | --- |
| Effective policy | optional project config | Defaults to `apply` + `supervised` when config is absent |
| `execution_mode` | `.sdd-agentic-flow/config.yml` | What a skill may do (plan / guided / apply / review / full) |
| `autonomy_level` | same config | Whether the next skill needs a human between steps |
| `autonomy_budget` | same config | Iteration/token/runtime limits (guardrail 6) |
| Capability contract | each `SKILL.md` and `saf-contract.yml` sidecar | Inputs, outputs, baselines, and SAF metadata |
| Guardrails 1–7 | `shared/references/autonomy-guardrails.md` | When `autonomous` may auto-advance |
| Loop state | `.sdd-agentic-flow/autonomy/loop-state.md` | Resume point, overrides, last skill status |
| Evidence | check/validation reports, `Status:` field | Whether "done" is believable |
| Routing | `saf-route` + `workflow-routing.md` | Which skill is on-path |
| Doctor | `npx sdd-agentic-flow doctor` | Static validation of config, skills, autonomy setup |

Specs (`.specs/features/`) are active-change working artifacts. Toolkit state
(`.sdd-agentic-flow/`) belongs to **this installation** and is regenerable except
hand-edited durable config. Source, tests, contracts, and intentionally promoted
project documentation become durable truth after the change is accepted.

## Glossary (12 terms)

The [canonical vocabulary](../shared/references/canonical-vocabulary.md) defines the broader
Intent → Capability → Execution → Control → Verification taxonomy. The glossary below keeps the
terms most useful when operating this toolkit.

| Term | Meaning |
| --- | --- |
| **Skill** | Markdown contract (`SKILL.md`) the agent reads and follows |
| **Capability contract** | Frontmatter fields (`requires`, `consumes`, `produces`, …) linking skills |
| **Feature profile** | Uncertainty/risk sizing hint (`small_fix` … `epic`) persisted with a work package; an explicit project config value is an advanced override |
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

- [Engineering model](engineering-model.md) — principles and control boundary
- [SDD methodology](sdd-methodology.md) — phase table and flow
- [Architecture](architecture.md) — layers and file layout
- [Autonomy levels](autonomy-levels.md) · [Autonomy guardrails](autonomy-guardrails.md)
- [Compatibility promise](compatibility-promise.md) — the active compatibility boundary
