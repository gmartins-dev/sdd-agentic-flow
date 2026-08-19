# Engineering model

`sdd-agentic-flow` is a **repository-native engineering control plane for
Spec-Driven coding-agent workflows**. It is a control layer, not a scheduler,
worker runtime, session store, or agent framework.

> Intent is durable. Work is bounded. Context is scoped. State is external.
> Evidence is observable. Verification is independent. Autonomy is conditional.
> Humans retain authority.

## Principles

1. **Durable intent** — specifications preserve the behavior and decision context.
2. **Bounded work** — each task has observable completion criteria (`GOAL-001`).
3. **Minimum sufficient context** — workers load a task context package, not a whole history.
4. **Capabilities over persistent personas** — a Skill names an engineering capability; a worker or subagent is host execution context.
5. **Externalized control state** — artifacts and loop state make transitions reconstructable.
6. **Evidence before verdict** — sensors observe; evidence records; verification evaluates against requirements.
7. **Conditional autonomy** — guardrails permit a next admissible action only while humans retain consequential authority.

## Control boundary

```text
human intent → specification → bounded work
                              ↓
                 scoped context + capabilities
                              ↓
                       policy / gates
                              ↓
                      admissible action
                              ↓
               host/human chooses execution
                              ↓
                  host execution → tools → sensors
                                             ↓
                                      current evidence
                                    ↙                 ↘
                           verification       evidence graph
                                    ↓            (projection)
                             transition state
                          ↙        ↓         ↘
                    admissible  blocked  human decision
```

The model proposes. The host executes. SAF defines constraints and admissible
transitions. Sensors observe. Evidence records. Verification evaluates. Humans
govern. A blocked transition is not permission for the host to continue; a
human decision is not a host decision.

## Graphs and correctness

| Graph | Owner | Question |
| --- | --- | --- |
| Dependency graph | SAF tasks DAG | What may run in parallel? |
| Execution graph | Host | Who executes the next turn or worker? |
| Evidence graph | SAF projection | Why is REQ-X believed satisfied? |

Correctness dimensions are explanatory, not a mandatory five-gate pipeline:
structural validity, behavioral evidence, domain/contract validity, and
requirement coverage. Domain semantics belong to the oracle; sensors observe
whether the oracle holds. Passing these dimensions never resolves a
consequential human-judgment boundary.

See the [mental model](sdd-agentic-flow-model.md), [architecture](architecture.md),
and [bounded execution](../shared/references/bounded-execution.md).
