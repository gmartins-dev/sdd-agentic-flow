# Decision Gates

Use a Decision Gate only after the agent has attempted resolution with the delegated intent,
canonical repository evidence, applicable contracts, and bounded re-planning, and continuing would
exceed delegated authority. This includes material changes to scope, business semantics, external
contracts, security, irreversible mutation, human authority, or genuinely underdetermined product
preference. Technical architecture choices that preserve intent and follow repository evidence
remain autonomous choices.

## Required fields

```text
Decision required
Why human judgment is required
Known bounded options (when known)
Affected scope
Blocked transition or task
Safe independent work (when any)
```

Decision gates block autonomous completion authority only when the agent cannot preserve the
delegated intent and boundaries. They do not replace ordinary engineering recovery or authorize an
agent to invent a materially underdetermined preference.

See [system-invariants.md](system-invariants.md) (AMBIGUITY-001, JUDGMENT-001) and
[bounded-execution.md](bounded-execution.md).

## Contract-change proposals and admission

A consequential mismatch with the effective contract may produce a bounded contract-change
proposal. The proposal records the affected requirement or acceptance criterion, the observed
mismatch, why the current contract cannot safely be followed, the bounded proposed change, and
the blocked transition. A proposal is non-authoritative: it is not evidence, does not change the
effective contract, and does not authorize implementation of its proposed semantics.

Admission is the applicable human decision at this existing gate. It is not a lifecycle value, an
evidence `Status:`, a persisted `admitted` field, or a universal approval step before ordinary
implementation. When a human accepts the proposal, the existing canonical authoring path updates
the effective contract. When a human rejects it, the effective contract remains unchanged and
work remains blocked unless it can safely proceed against that contract.

After an accepted change, affected evidence must be re-evaluated under the existing freshness
rules before downstream work advances. Do not create a second admission ledger or proposal
artifact for this flow.
