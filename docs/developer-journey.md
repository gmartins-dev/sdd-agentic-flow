# Developer journey

This practical journey applies the [engineering model](engineering-model.md). It is a
repository-neutral illustration, not a provider protocol, storage design, or production recipe.

## 1. Intent and specification

**Illustrative example.** A human wants to avoid duplicate business effects when a webhook is
delivered more than once. The specification records `REQ-1` (duplicates create one business
effect), `REQ-2` (a legitimate retry gets a response), and `REQ-3` (a failure before commit can
be retried). It then bounds T1 to the identity/transaction boundary, T2 to the protected handler,
and T3 to adequate sensors.

## 2. Context, capability, policy

**Normative SAF contract.** The task receives minimum sufficient context and the selected SAF
capability. Policy, gates, verification, and human authority determine whether the next
transition is admissible; the coding-agent host performs execution. See
[bounded execution](../shared/references/bounded-execution.md) and
[evidence standard](../shared/references/evidence-standard.md).

**Illustrative example.** In a Supervised workflow, the human retains authority to accept the
next transition. Admissibility never starts a host turn by itself.

## 3. Host execution and sensors

**Host-dependent behavior.** The coding-agent host inspects files, edits, runs commands, and may
use workers. SAF owns no session, tool, or worker runtime state.

**Illustrative example.** Two duplicate deliveries can both return HTTP 200 while two business
effects were recorded. Those responses are sensors, not an adequate oracle for `REQ-1`. An
adequate observable oracle counts persisted business effects for the same delivery identity and
expects exactly one; a pre-commit failure followed by retry supplies the `REQ-3` sensor.

## 4. Evidence, verification, and transition

**Normative SAF contract.** Sensors produce observations. Current evidence records observations
still relevant to the current state. Verification independently evaluates whether that evidence
adequately supports `REQ-1` through `REQ-3`. The Evidence Graph is read-only traceability, never
orchestration authority. See [canonical vocabulary](../shared/references/canonical-vocabulary.md).

**Illustrative example.** A test may become stale after the handler changes; the Evidence Graph
can show its old requirement link but cannot authorize work. Verification can block progression
despite green agent-authored tests when the exactly-one oracle is absent.

An unresolved question remains consequential: is the idempotency key scoped per provider event,
tenant, endpoint, or business operation? That requires human judgment. The transition is therefore
`admissible`, `blocked`, or `requires human judgment`; a host executes only after the admissible
or human-authorized outcome.

## Illustrative timeline

```text
human intent → REQ-1..3 → T1/T2/T3 → scoped context + capability
→ policy/gates → host execution → sensors → current evidence → verification
→ admissible | blocked | requires human judgment
```
