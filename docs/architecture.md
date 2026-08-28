# Architecture

`sdd-agentic-flow` is a local-first, zero-runtime-dependency toolkit.

```text
CLI domain
  → installs one official bundle and shared layer
  → initializes one exact Git workspace
  → persists optional policy/adoption overrides

Installed skills
  → portable SKILL.md frontmatter
  → SAF-only saf-contract.yml sidecar
  → shared references and templates

Consumer workspace
  → optional .sdd-agentic-flow/config.yml
  → local .sdd-agentic-flow/workspace.yml
  → optional generated context
  → configured SAF specs root (local by default)
```

Skills never call the CLI. The CLI never authors feature specifications. The
host owns agent execution, concurrency, branches, and worktrees.

## Maintainer source layout

| Module | Responsibility |
| --- | --- |
| `sdd-agentic-flow.ts` | CLI dispatch and presentation |
| `install.ts`, `install-domain.ts`, `install-preflight.ts` | Official bundle plan/apply, user installation, and v4 state |
| `workspace.ts`, `git-context.ts` | Git-aware workspace plan/apply and identity; never a prerequisite for user install |
| `config.ts`, `config-domain.ts`, `configure.ts` | Effective defaults and explicit overrides |
| `clean-upgrade.ts`, `uninstall.ts` | Bounded reset and removal |
| `recovery.ts` | Pure remediation planning from observed facts |
| `doctor.ts` | Installation, Workspace, and Policy readiness |
| `skill-contract.ts`, `contract-graph.ts` | Sidecar parsing and contract validation |

## Capability contracts

Agent Skills frontmatter contains only portable identity and compatibility
fields. `saf-contract.yml` uses `saf-skill-contract/v1` and may declare
`extends`, `requires`, `consumes`, `produces`, `baseline`, `depends_on`,
`conflicts`, `requires_cli`, and autonomy behavior. The restricted parser
rejects duplicate/unknown keys and executable or ambiguous YAML features.

Missing config is optional enrichment and resolves through
`shared/references/effective-defaults.md`. A missing `requires` semantic input
still blocks its skill. References must resolve within the official 12-skill
roster and official skills may not conflict.

Current state schemas are `saf-config/v3`, `saf-install-intent/v4`,
`saf-install-provenance/v3`, and `saf-workspace/v1`. Older installation state
is readable only as bounded previous state; future or unknown state is preserved
and blocks automatic mutation. An explicit reset may remove only canonical SAF
paths whose ownership is known to the running CLI.

SAF working artifacts are ephemeral by default. The configured specs root is
local for personal adoption and for new Team profiles unless the user chooses
shared visibility. Specs shared is the explicit exception. Generated state
under `.sdd-agentic-flow/` stays local; durable project knowledge belongs in
source, tests, ADRs, RFCs, or maintained project documentation.

See [compatibility promise](compatibility-promise.md),
[information representation model](information-representation-model.md), and
[CONTRIBUTING.md](../CONTRIBUTING.md#where-new-cli-code-belongs).
