# Autonomy guardrails

The 7 deterministic checks an agent evaluates before letting a skill running at
`workflow.autonomy_level: autonomous` (see [autonomy levels](autonomy-levels.md)) advance to the
next skill without asking a human first. Each one is auditable — a yes/no answerable from the
skill's own reported output, its declared `autonomy_profile`, and `.sdd/config.yml` — not a
judgment call. A single failure blocks the advance and hands control back to the human, exactly
as `autonomy_level: manual` already would.

## The 7 guardrails

1. **Completion status** — the skill reports `PASS`/`DONE`, not `IN_PROGRESS`, `UNKNOWN`, or
   `FAIL`.
2. **Evidence validation** — every artifact the skill's `autonomy_profile.evidence_required`
   lists actually exists and is non-empty.
3. **Verification gates** — the skill's own required checks (tests, linter, spec consistency, no
   blocking findings) all pass; a skill never reports `PASS` while a required check failed.
4. **Scope boundary** — the work stayed inside the task's declared scope (files touched, lines
   changed); it did not silently expand into unrelated files or new features.
5. **Skill transition validity** — the proposed next skill is on the authorized workflow path
   (`README.md`'s main SDD flow diagram); this blocks skipping or reversing a step, e.g. advancing
   straight from `sdd-create-specs` to `sdd-pr-review`.
6. **Resource sufficiency** — `workflow.autonomy_budget` (`max_iterations`, `max_tokens`,
   `max_runtime_hours`) is not exhausted; `pause_on_warning: true` stops, not just warns, once
   remaining budget drops below roughly 20%.
7. **Human override gate** — no `pause: true` or `stop: true` is recorded in
   `.sdd/autonomy/loop-state.md`. This is the one guardrail not evaluated automatically by
   construction — it exists so a human can halt an in-flight autonomous run by editing state,
   without needing to find and kill a process.

If any guardrail fails, the agent stops, records the failing guardrail and its reason in
`.sdd/autonomy/loop-state.md`, and waits for a human — who either fixes the underlying cause and
re-runs the skill, or runs `sdd-agentic-flow autonomous-resume` (optionally with
`--override-guard=<1-7> --reason="..."` to log an explicit, audited bypass).

## Reading a blocked run

```bash
npx sdd-agentic-flow context autonomy-state
```

reports the last recorded skill, its status, the proposed next skill, and whether a human
override is set — without changing anything. `doctor --autonomy` additionally validates the
*static* setup (config values, the matrix, per-skill `autonomy_profile` support, the budget) so a
misconfiguration surfaces before a run ever starts, not mid-run.

## Why 7, not 5 or 10

Seven covers every distinct failure vector this model needs to guard: whether the skill itself
finished (1), whether its claims are backed by artifacts (2) and passing checks (3), whether the
change stayed where it was authorized to be (4), whether the next step is the right one (5),
whether the run still has budget to keep going (6), and whether a human has asked it to stop (7).
Fewer would leave a real gap (e.g. dropping 4 lets scope creep through unnoticed); more would
duplicate one of these seven under a different name.

## Scope: what this governs, and what it does not

Guardrails gate **skill-to-skill transitions only**. `autonomous` never implies "skip
`no_commit_by_default`," "ignore an explicit scope boundary," or "assume a tool call is safe" —
`execution_mode` still governs what a skill is authorized to do; `autonomy_level` only governs
whether the agent asks before invoking the next one. There is no orchestration engine in this CLI
that executes skills on a loop: `autonomy_level` and its guardrails are a contract the skills and
the invoking agent honor, validated statically by `doctor --autonomy`, not a runtime this package
hosts. See the internal reference
[autonomy guardrails](../shared/references/autonomy-guardrails.md) for the exact
`autonomy_profile` frontmatter shape and the `.sdd/autonomy/loop-state.md` format every skill and
the CLI read and write.
