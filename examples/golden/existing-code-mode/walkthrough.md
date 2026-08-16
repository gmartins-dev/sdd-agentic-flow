# Golden flow: existing-code mode

Proved by `test/cli.test.ts` — `golden flow: existing-code mode artifacts carry
Observed/Inferred/Unknown labels and are accepted`.

## Fixture

`source/discount.js` is a tiny, realistic module with no prior spec. `context.md`, `spec.md`,
and `design.md` in this directory are what `saf-create-spec` in **existing-code mode** would
produce for it — every finding labeled `Observed` (directly shown by the code), `Inferred` (a
reasonable reading no test directly confirms), or `Unknown` (a gap neither the code nor its
tests answer), exactly as the skill's `SKILL.md` requires.

## Commands

```bash
sdd-agentic-flow init
sdd-agentic-flow install core --scope project
```

Then `context.md`, `spec.md`, and `design.md` are copied to
`.specs/features/discount-calculator/`, and:

```bash
sdd-agentic-flow doctor --json
```

## Expected result

- `spec.md` carries `# Specification — discount-calculator`, at least one `(Observed)` and one
  `(Unknown)` requirement label, and `## Acceptance criteria`.
- `design.md` carries `# Design — discount-calculator` with both `Observed:` and `Inferred:`
  labeled decisions.
- Overall `doctor` status is not `FAIL`.

No `tasks.md` is produced here — the fixture illustrates the "no follow-up work confirmed"
path from `saf-create-spec`'s existing-code mode, where `tasks.md` is only created if the
user confirms follow-up work is needed.
