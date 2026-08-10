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

## Workflow phases

The main chain runs in order, with review gates between implementation and acceptance:

Plan → Prompt → Implement → Check → PR → Review → Fix → Validate → Release (on demand)

| Phase | Typical skill | What you get |
| --- | --- | --- |
| Shape the idea | `sdd-brainstorm` | Spec-ready brief |
| Plan | `sdd-create-specs` | Feature spec set |
| Prompt | `sdd-create-prompts` | Agent-ready task prompts |
| Implement | `sdd-implement-task` / `sdd-implement-multi` | Code and evidence |
| Check | `sdd-task-check` | Independent check report |
| PR | `sdd-create-pr` → `sdd-pr-review` → `sdd-pr-fix` | Traceable review package |
| Validate | `sdd-validation` | Feature validation report |
| Release | `sdd-release` | Release readiness report (read-only) |

When the next step is unclear, invoke `sdd-route`. It recommends a skill; it does not run the workflow for you. See [workflow](workflow.md) and the [invocation model](invocation-model.md).

## Why specs help agents

Agents work best with a narrow, verifiable target—the five-second moment you want is *evidence passes*, not *the agent said done*:

- **Scope:** a spec names what is in and out of the task, so the agent does not expand silently.
- **Context:** artifacts in `.specs/features/` give the agent stable input across sessions instead of re-explaining in chat.
- **Review gates:** `sdd-task-check` and `sdd-validation` separate "the agent said it done" from "evidence says it passes."
- **Model choice:** a clear spec and task prompt reduce ambiguity; that makes smaller or cheaper models usable for bounded slices (quality still depends on the task and your review).

This toolkit does not measure token savings or speed multipliers. A token economics benchmark is planned for a future release; see [ROADMAP.md](../ROADMAP.md).

## With this toolkit

1. **CLI** (`npx sdd-agentic-flow`) creates `.sdd/config.yml`, installs Markdown skills, and runs `doctor`.
2. **Skills** (14 public) encode each phase as a capability contract with safety defaults.
3. **Baselines** condense TLC for planning and TDD for implementation; see [baselines](baselines.md).

Start with the [skills usage guide](sdd-skills-usage-guide.md). Follow a proven path in the [task-management golden example](../examples/golden/task-management/walkthrough.md).

## Next steps

```bash
npx sdd-agentic-flow init
npx sdd-agentic-flow install core
npx sdd-agentic-flow doctor
```

Pick a [feature profile](guides/choosing-a-feature-profile.md), read [prompt recipes](prompt-recipes.md), and invoke `sdd-route` when you need a recommendation for the next skill.
