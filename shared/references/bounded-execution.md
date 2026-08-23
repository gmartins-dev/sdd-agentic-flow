# Bounded execution

Host-neutral semantic contract. Not a task artifact, frontmatter schema, retry engine or host adapter.

## Fields

```text
Goal                 bounded intended outcome
Completion criteria  observable state that demonstrates it
Iteration policy     iteration-safe | bounded-with-gate | human-judgment
Stop/escalation      satisfied | missing evidence | no semantic progress | decision gate | unsafe scope
```

`deterministic`, `observable` and `measured` criteria can support bounded autonomous iteration.
`human-judgment` criteria let an agent prepare evidence and options but retain human completion authority.

## Evidence vocabulary

For Sensor, Evidence, Oracle, Adequacy, Verification, Freshness and Decision, apply
[evidence-standard.md](evidence-standard.md). No second vocabulary is introduced here.

Do not prescribe an arbitrary universal retry count or persist generic per-attempt history outside
the multi-task ledger.

## Host boundary

A SAF Skill never autonomously starts another host turn. It reports whether another bounded attempt
or Skill transition is admissible, blocked, or requires human judgment. In autonomous mode, the
invoking host/agent is expected to continue an admissible repair or normal transition when budget
and host capability permit it; SAF remains the contract, not the runtime.

See [task-context-package.md](task-context-package.md) and [system-invariants.md](system-invariants.md).
