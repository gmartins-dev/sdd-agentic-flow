# Spec lifecycle

`sdd-agentic-flow` keeps feature packages on disk under `.specs/features/<slug>/`. The path does not change. What changes in this contract is **which package the agent resolves** and **which artifacts it loads** for the active operation.

The canonical rules live in [shared/references/spec-lifecycle.md](../shared/references/spec-lifecycle.md). Skills load that file at install time. This file is **not a skill**, **not a TLC/TDD baseline**, **not a CLI**, and **not a registry**.

## When it applies

Use the contract whenever a skill needs a spec package: creating or updating specs, writing prompts, implementing or checking a task, explaining a feature, validating a feature, or routing when the request does not name a slug.

## Summary

- Path unchanged: `.specs/features/<slug>/`. No `.specs/active/` or `.specs/archive/`.
- Resolve one package (0 ask / 1 select / >1 human gate). Then load only artifacts the **active skill’s Inputs/Workflow already names**.
- Optional advisory `Lifecycle:` (`draft` | `active` | `implemented` | `superseded` | `abandoned`) and canonical `Extends:` / `Supersedes:` lines. Lifecycle describes; it does not command. Use `implemented`, not `completed`.
- Git is file-level history; folders are change-level records. SAF working specs
  are local by default. `specs-shared` and an explicit Team choice may expose
  the configured specs root, but SAF never stages or commits it.
- `saf-validate` may write a report under `.sdd-agentic-flow/reports`. It does not archive. It never creates `validation.md` under `.specs`. Uninstall still never deletes `.specs/features`.

## Short example

A repo has `.specs/features/invoice-approval/` and `.specs/features/task-management/`. The user says “implement T3.” The agent does **not** glob every `spec.md`. It resolves the package already named in the task prompt (one unique match), then loads only `saf-implement`’s existing Inputs. Sibling folders stay on disk as history.

If two packages both look plausible and the request names neither, stop and ask. Do not pick “probably invoice-approval.”

## Related docs

- [shared/references/spec-lifecycle.md](../shared/references/spec-lifecycle.md) — full contract
- [sdd-methodology.md](sdd-methodology.md) — living specs and the SDD chain
- [installation-scope.md](installation-scope.md) — working-spec visibility
- [baselines.md](baselines.md) — on-demand load invariant; still no STATE/LESSONS/Verifier copy
