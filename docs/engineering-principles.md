# Engineering principles

`sdd-agentic-flow` ships a language- and architecture-agnostic contract for *how agents change code*. It is **not a skill** and **not a TLC/TDD baseline**. Existing SDD skills still decide which workflow step to run. The evidence standard still decides whether a result can be trusted.

The canonical rules live in [shared/references/engineering-principles.md](../shared/references/engineering-principles.md). Skills load that file at install time. Read this doc for when the contract applies and what it is not.

Stack-specific security and web practices (CSP, Helmet, `npm audit` as a gate, Lighthouse, framework error boundaries) are out of core. Do not treat the shared file as an OWASP catalog or as a fifteenth skill.

## When it applies

Use the contract when a skill is about to change code, write a design that implies an architecture, generate implementation prompts, or independently judge engineering fit. Routing, setup, explanation, brainstorm, PR packaging, validation, and release stay requirement/evidence scoped unless they already point at this file.

## Summary

- Search existing patterns. Prefer modifying an existing file. Keep the complexity budget.
- KISS / YAGNI / DRY-pragmatic findings do **not** flip check or validation `PASS` by themselves.
- Spec misses and evidence failures stay blocking. The human remains the gate.

## Related docs

- [shared/references/engineering-principles.md](../shared/references/engineering-principles.md) — full contract
- [tdd-baseline.md](tdd-baseline.md) — sensors / behavior loop
- [evidence-standard.md](../shared/references/evidence-standard.md) — what counts as proof
- [design-principles.md](design-principles.md) — product design goals
