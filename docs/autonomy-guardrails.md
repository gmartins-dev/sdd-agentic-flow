# Autonomy guardrails

**Autonomous does not mean unlimited authority.** Seven deterministic checks an agent evaluates
before a Skill running at `workflow.autonomy_level: autonomous` advances or takes an authorized
repair transition. Each check is auditable from the Skill's output, its `autonomy_profile`, and
`.sdd-agentic-flow/config.yml`. Recoverable findings continue through repair; exceptional blockers
return control to a human.

For level definitions and configuration, see [autonomy levels](autonomy-levels.md). For the full guardrail definitions, `autonomy_profile` frontmatter shape, and `.sdd-agentic-flow/autonomy/loop-state.md` format, see [shared/references/autonomy-guardrails.md](../shared/references/autonomy-guardrails.md). To read which SDD flow phase a `loop-state.md` entry's `Skill:` value corresponds to, see the `Phase | Typical skill` table in [sdd-methodology.md](sdd-methodology.md#workflow-phases).

## The 7 guardrails

1. **Outcome classification** — the Skill reports a native status that can be classified as
   satisfied, recoverable, exceptional, or exhausted.
2. **Evidence validation** — every artifact in `autonomy_profile.evidence_required` exists and is non-empty.
3. **Verification integrity** — required checks are executed or explicitly accounted for. Normal
   forward progression requires applicable checks to pass; an observed attributable failure may
   instead authorize a repair transition. A positive completion status is forbidden while a
   required check fails.
4. **Scope boundary** — delegated semantic scope remains bounded; evidence may require additional
   implementation touchpoints.
5. **Skill transition validity** — the proposed next Skill is an authorized normal or repair path
   (see [README](../README.md#how-it-works)).
6. **Resource sufficiency** — `workflow.autonomy_budget` is not exhausted; `pause_on_warning: true` stops once remaining budget drops below roughly 20%.
7. **Human override gate** — no `pause: true` or `stop: true` in `.sdd-agentic-flow/autonomy/loop-state.md`.

If a guardrail identifies an exceptional blocker or exhausted execution, the agent stops, records
the reason in `.sdd-agentic-flow/autonomy/loop-state.md`, and waits for a human. A recoverable
outcome records its native status and authorized repair `Next`; the invoking host/agent continues.

## CLI surfaces

```bash
npx sdd-agentic-flow context autonomy-state   # read loop state without changing it
npx sdd-agentic-flow doctor --autonomy        # validate static setup before a run
npx sdd-agentic-flow autonomous-resume        # resume after a human fix
```

## Scope

Guardrails gate Skill-to-Skill transitions only. `autonomous` never implies "skip
`no_commit_by_default`" or "ignore scope boundaries." `execution_mode` still governs what a Skill
may do; `autonomy_level` governs whether the agent repairs, advances, or escalates before the next
transition. There is no orchestration engine in this CLI that runs Skills in a loop.
