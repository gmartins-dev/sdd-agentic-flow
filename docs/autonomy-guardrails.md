# Autonomy guardrails

Seven deterministic checks an agent evaluates before a skill running at `workflow.autonomy_level: autonomous` advances to the next skill without asking a human. Each check is auditable from the skill's reported output, its declared `autonomy_profile`, and `.sdd/config.yml`. One failure blocks the advance and returns control to the human, same as `autonomy_level: manual`.

For level definitions and configuration, see [autonomy levels](autonomy-levels.md). For the full guardrail definitions, `autonomy_profile` frontmatter shape, and `.sdd/autonomy/loop-state.md` format, see [shared/references/autonomy-guardrails.md](../shared/references/autonomy-guardrails.md). To read which SDD flow phase a `loop-state.md` entry's `Skill:` value corresponds to, see the `Phase | Typical skill` table in [sdd-methodology.md](sdd-methodology.md#workflow-phases).

## The 7 guardrails

1. **Completion status** — the skill reports `PASS`/`DONE`, not `IN_PROGRESS`, `UNKNOWN`, or `FAIL`.
2. **Evidence validation** — every artifact in `autonomy_profile.evidence_required` exists and is non-empty.
3. **Verification gates** — required checks (tests, linter, spec consistency, no blocking findings) all pass.
4. **Scope boundary** — work stayed inside the task's declared scope; no silent expansion into unrelated files or features.
5. **Skill transition validity** — the proposed next skill is on the authorized workflow path (see [README](../README.md#main-sdd-flow)).
6. **Resource sufficiency** — `workflow.autonomy_budget` is not exhausted; `pause_on_warning: true` stops once remaining budget drops below roughly 20%.
7. **Human override gate** — no `pause: true` or `stop: true` in `.sdd/autonomy/loop-state.md`.

If any guardrail fails, the agent stops, records the failing guardrail in `.sdd/autonomy/loop-state.md`, and waits for a human. The human fixes the cause and re-runs the skill, or runs `sdd-agentic-flow autonomous-resume` (optionally with `--override-guard=<1-7> --reason="..."` for an audited bypass).

## CLI surfaces

```bash
npx sdd-agentic-flow context autonomy-state   # read loop state without changing it
npx sdd-agentic-flow doctor --autonomy        # validate static setup before a run
npx sdd-agentic-flow autonomous-resume        # resume after a human fix
```

## Scope

Guardrails gate skill-to-skill transitions only. `autonomous` never implies "skip `no_commit_by_default`" or "ignore scope boundaries." `execution_mode` still governs what a skill may do; `autonomy_level` governs whether the agent asks before invoking the next skill. There is no orchestration engine in this CLI that runs skills in a loop.
