# Canonical vocabulary

Use one term for one concept. These terms describe SAF's outer workflow harness,
not a host runtime implementation.

- **Agentic Workflow Harness:** SAF's public category: repository-local contracts
  and control artifacts that bound and make coding-agent workflow transitions assessable.
- **Host runtime harness:** the coding-agent host's model, sessions, tools, workers,
  hooks, and sandbox. SAF does not own or implement it.
- **Skill / capability:** public engineering guidance, not a persistent agent, worker,
  or runtime execution layer.
- **Runtime execution:** host-owned inspection, editing, command execution, and delegation
  after an admissible or human-authorized transition.

| Layer | Terms | Meaning |
| --- | --- | --- |
| Intent | Specification, Requirement, Task | The behavior and bounded work to achieve it |
| Capability | Skill, Instruction, Prompt | A public capability contract, durable guidance, and a concrete request |
| Execution | Host, Agent, Worker, Tool, Hook, Action | The runtime, reasoning actor, delegated unit, executable capability, runtime callback, and bounded operation |
| Control | Policy, Guardrail, Gate, Decision Gate, Stage, State, Status, Transition | Rules and conditions governing workflow movement |
| Verification | Sensor, Evidence, Finding, Verdict | Observation, result, derived issue, and aggregated decision |

`Worker` is host-neutral; a host may implement it with a subagent, a fresh
session, or serial work. `Tool` and `Hook` are runtime mechanics, not skills.
`Action` is one bounded operation and is not a synonym for a skill. `Stage` is
a macro workflow phase; `Status` is one value within state. Governance names
the control layer collectively, not another runtime object.

`DependencyGraph` is the SAF task DAG; `ExecutionGraph` is host-owned worker or
turn selection; `EvidenceGraph` is a read-only SAF traceability projection.
Skills are capabilities, not persistent agents or workers. A host may supply a
fresh worker for independent verification, but SAF falls back to re-grounding
the oracle from canonical artifacts when it cannot.
