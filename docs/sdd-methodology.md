# Spec-Driven Development methodology

The shift is simple: stop debating what the agent *should* have built after the fact. Agree on the spec first—behavior, boundaries, and evidence—then let the agent change code against that contract.

Spec-Driven Development (SDD) treats that written spec as the agreement between you and a coding agent. This toolkit ships the skills, CLI, and local config to run the contract on your machine. You stay the decision-maker; the workflow holds the gates.

For the short problem statement, see [why this exists](why-this-exists.md). For the full narrative, see the [README](../README.md).

## Principles

This package follows a small set of design goals. See [design principles](design-principles.md) for the authoritative list. In practice:

- **Local-first:** skills and config live in your repo or user scope; nothing phones home by default.
- **Evidence before completion:** tasks produce check reports and validation evidence, not just chat output.
- **Human final authority:** agents propose and implement; you approve gates, PRs, and releases.
- **Bounded work:** one task at a time, with explicit scope in specs and prompts.

A rich domain model — named invariants, not only a list of screens — gives the agent
something to check against. That is why specs help; it is not a DDD pack in this toolkit.

## Workflow phases

TLC condensed stages (Specify → Discuss → Design → Tasks → Execute → Verify) are the
**methodology**. The skill sequence below is how this toolkit **implements** that
methodology. They are not two products. After this paragraph, this toolkit calls that
skill sequence the **canonical workflow path** (not a “linear chain” — review, fix, and
multi-task are controlled workflow selections). Operating **presets** (`init --preset`) only
choose how much human interaction that path asks for. `saf-route` discovers the next
operation; it does not run the path.

The canonical workflow path:

Plan → Prompt → Implement → Check → PR → Review → Fix → Validate

| Phase | Typical skill | What you get |
| --- | --- | --- |
| Shape the idea | `saf-brainstorm` | Spec-ready brief |
| Plan | `saf-create-spec` | Feature spec set |
| Prompt | `saf-create-prompts` | Agent-ready task prompts |
| Implement | `saf-implement` / `saf-implement-multi` | Code and evidence |
| Check | `saf-check-task` | Independent check report |
| PR | `saf-create-pr` → `saf-review-pr` → `saf-fix-pr` | Traceable review package |
| Validate | `saf-validate` | Feature validation report |

When the next step is unclear, invoke `saf-route`. It recommends a skill; it does not run the workflow for you. See [workflow](workflow.md) and the [invocation model](invocation-model.md). Direct → `saf-brainstorm` → `saf-create-spec` is the Plan-mode analogue — not a separate Plan skill.

Work **intent** (`feature` / `bugfix` / `refactor` / `investigation` / `maintenance`) is inferred and stated in the spec package. It is not a config key. Combine it with `feature_profile`. See [work types](../shared/references/work-types.md). Specifications are **living** control artifacts: on drift, stop and reconcile; do not silently implement a better requirement. Resolve one feature package, then load only the artifacts the active operation already requires; see [spec lifecycle](spec-lifecycle.md).

### Named feedback loop (not auto-run)

```text
IMPLEMENT
    ↓
CHECK  (saf-check-task)
    ↓
NEEDS_CHANGES ──► IMPLEMENT   (bounded; autonomous repair when delegated)
    ↓
VALIDATION
    ↓
REVALIDATE OR ESCALATE
```

PR path remains `saf-create-pr` → `saf-review-pr` → `saf-fix-pr`. In autonomous mode, review and
validation findings authorize the owning repair path without a new confirmation; safety, authority,
underdetermined intent, budget, and no-progress boundaries still escalate. Suggest a bound as
guidance, not a CLI `max_iterations`. This package does not auto-run the loop.

## Why specs help agents

Agents work best with a narrow, verifiable target—the five-second moment you want is *evidence passes*, not *the agent said done*:

- **Scope:** a spec names what is in and out of the task, so the agent does not expand silently.
- **Context:** artifacts in `.specs/features/` give the agent stable input across sessions instead of re-explaining in chat.
- **Review gates:** `saf-check-task` and `saf-validate` separate "the agent said it done" from "evidence says it passes." They re-derive expected from the spec, re-run current sensors, and apply the false-positive catalog. Self-report is not evidence. They must not inherit author narrative.
- **Model choice:** a clear spec and task prompt reduce ambiguity; that makes smaller or cheaper models usable for bounded slices (quality still depends on the task and your review).

This toolkit does not measure token savings or speed multipliers. A token economics benchmark is planned for a future release; see [ROADMAP.md](../ROADMAP.md).

## With this toolkit

1. **CLI** (`npx sdd-agentic-flow`) creates `.sdd-agentic-flow/config.yml`, installs Markdown skills, and runs `doctor`.
2. **Skills** (13 public) encode each phase as a capability contract with safety defaults.
3. **Baselines** condense TLC for planning and TDD for implementation; see [baselines](baselines.md).
   Humans decide *what* must be true; agents may choose *how* to produce the code; sensors
   produce evidence; verification evaluates that evidence against the spec; the human decides.

Start with the [skills usage guide](saf-skills-usage-guide.md). Follow a proven path in the [task-management golden example](../examples/golden/task-management/walkthrough.md).

## Next steps

```bash
npx sdd-agentic-flow init
npx sdd-agentic-flow install
npx sdd-agentic-flow doctor
```

Pick a [feature profile](guides/choosing-a-feature-profile.md), read [prompt recipes](prompt-recipes.md), and invoke `saf-route` when you need a recommendation for the next skill.
