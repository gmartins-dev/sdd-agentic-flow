# Golden flow: PR (create → review → fix → review)

Proved by `test/cli.test.js` — `golden flow: PR fixtures match the pr-* template presence
contract from artifact-contracts.md`.

None of `saf-create-pr`, `saf-review-pr`, or `saf-fix-pr` are CLI subcommands — they are
`SKILL.md` files interpreted by an agent, not something this package's CLI can invoke or run
end-to-end by itself. What the CLI *can* prove mechanically is that its templates
(`shared/templates/pr-description.template.md`, `pr-review.template.md`, `pr-fix.template.md`)
exist and that artifacts shaped like them satisfy the presence contract documented in
`shared/references/artifact-contracts.md`. This fixture does not call any GitHub API — no
network by default, same promise as everywhere else in this package.

## Fixture

- `pr-package.md` — what `saf-create-pr` would produce for task `T1` of the `task-management`
  golden flow.
- `review-findings.md` — what `saf-review-pr` would produce reviewing it (one non-blocking
  finding).
- `fix-evidence.md` — what `saf-fix-pr` would produce, since the only finding was non-blocking
  and needed no fix.

## Expected result

- `pr-package.md` carries `# task-management — T1`, `## Scope`, `## Evidence` — the required
  headers `artifact-contracts.md` documents for `pr-package`.
- `review-findings.md` and `fix-evidence.md` mirror their respective templates' structure
  (`# PR review — T1` / `## Findings`; `# PR fix — T1` / `## Actionable findings`).

## Agent workflow (illustrative, not run by the test)

```text
saf-create-pr  -> pr-package.md
saf-review-pr  -> review-findings.md
saf-fix-pr     -> fix-evidence.md          (only if findings are accepted and actionable)
saf-review-pr  -> re-review, until ready
saf-validate -> feature readiness
```
