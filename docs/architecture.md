# Architecture

`sdd-agentic-flow` is a local-first toolkit with zero external runtime npm dependencies. The
published CommonJS CLI may contain bundled build-time libraries, while requiring only Node.js at
runtime.

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

Every module in `src/` appears below; `npm run docs:check` fails when a module is missing.

| Module | Responsibility |
| --- | --- |
| `sdd-agentic-flow.ts` | Thin router: global argument preflight and one handler per canonical command |
| `command-registry.ts`, `cli-command.ts`, `cli-help.ts` | Canonical command grammar, completion, command rendering, usage, and help text |
| `cli-output.ts`, `handled-error.ts` | Shared human output helpers and the handled-failure (exit 1) error type |
| `welcome.ts`, `menu.ts`, `onboarding.ts` | Read-only bare-command status screen, interactive-menu gating, and onboarding state |
| `setup.ts`, `setup-plan.ts`, `setup-state.ts`, `recovery.ts` | Guided setup flow, setup planning, observed setup state, and pure remediation planning |
| `install.ts`, `install-domain.ts`, `install-preflight.ts` | Official bundle plan/apply, installation intent, `config installation`, and preflight |
| `upgrade-command.ts`, `upgrade.ts`, `update-check.ts`, `version-compat.ts` | Upgrade command, managed-file provenance and reconciliation, registry check, and version comparison |
| `clean-upgrade.ts`, `uninstall.ts` | Bounded legacy reset and provenance-owned removal |
| `workspace.ts`, `git-context.ts`, `adoption.ts` | Git-aware workspace plan/apply, repository identity, and adoption visibility |
| `config.ts`, `config-domain.ts`, `configure.ts`, `init-defaults.ts` | Effective defaults, explicit policy overrides, installation intent, and init defaults |
| `project-context.ts` | Project context provenance, refresh, and autonomy loop-state resume |
| `doctor.ts`, `doctor-view.ts`, `harness-readiness.ts` | Installation, Workspace, and Policy readiness checks and their presentation |
| `evidence-contract.ts`, `evidence-graph.ts`, `evidence-graph-html.ts` | Evidence report contract, evidence graph, and its HTML projection |
| `skill-contract.ts`, `contract-graph.ts`, `contract-kinds.ts`, `skill-identity.ts` | Sidecar parsing, contract validation, contract kinds, and the official Skill roster |
| `paths.ts`, `atomic-write.ts`, `messages.ts` | Package and workspace paths, durable file writes, and localized messages |
| `ui.ts`, `terminal-color.ts`, `selector.ts`, `terminal-ui.ts` | Terminal capabilities, centralized color detection, SAF-owned input semantics, and rich/plain presentation primitives |
| `terminal-components.ts`, `terminal-geometry.ts`, `terminal-safety.ts`, `terminal-theme.ts` | Presentation components, display geometry, terminal-safe text, and the theme |
| `brand-art.ts`, `brand-motion.ts`, `brand-animation.generated.ts` | Responsive brand art and motion; the animation module is generated |

`git-context.ts` is optional for user-scope installation: a plain user install works outside Git,
while project scope, adoption, and workspace initialization require Git metadata.

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
