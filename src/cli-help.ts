import { SDD_PATHS, SDD_ROOT } from './paths';

// Single source of truth for each command's one-line usage string, referenced both by main()'s
// fail(usage) calls and by the matching COMMAND_HELP entry's USAGE block below — introduced
// alongside --quiet (v1.4.0) specifically because it lands in 4 of these strings at once, which
// is exactly the kind of change that causes hand-duplicated copies to drift.
export const USAGE = {
  init: 'usage: init [--interactive|--non-interactive] [--language en-US|pt-BR | --en | --br] [--feature-profile small_fix|medium_feature|large_feature|epic] [--preset manual|supervised|autonomous] [--execution-mode plan|guided|apply|review|full] [--autonomy-level manual|supervised|autonomous] [--local-git-exclude] [--quiet]',
  install:
    'usage: install <pack> [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--plan] [--interactive|--non-interactive] [--quiet]',
  config: 'usage: config [show|policy [--plan] [--yes] [--preset manual|supervised|autonomous]]',
  configure:
    'usage: configure [--scope user|project] [--pack <pack>] [--target agents|cursor|claude|copilot] [--sharing shared|local] [--plan]',
  doctor:
    'usage: doctor [--json] [--harness] [--smoke] [--contracts] [--autonomy] [--evidence-graph <feature-slug> [--html [--output <path>]]] [--verbose] [--check-updates]',
  uninstall:
    'usage: uninstall --plan | uninstall --apply [--include-config] [--full] [--purge] [--yes] [--scope user|project] [--agent codex|cursor|claude-code|vscode-copilot] [--verbose] [--quiet]',
  discover: 'usage: discover [--force] [--quiet]',
  context: 'usage: context [status|refresh|autonomy-state]',
  'autonomous-resume':
    'usage: autonomous-resume [--force] | autonomous-resume --override-guard=<1-7> --reason="..."',
  upgrade: 'usage: upgrade [--check|--plan|--skills-only]',
};

export const KNOWN_COMMANDS = [
  'list',
  'init',
  'discover',
  'context',
  'config',
  'configure',
  'install',
  'doctor',
  'upgrade',
  'autonomous-resume',
  'uninstall',
  'learn-sdd',
  'help',
  'version',
];

export const COMMAND_HELP: Record<string, string> = {
  init: `sdd-agentic-flow init

Create local SDD configuration for the current project (${SDD_PATHS.config},
${SDD_PATHS.projectContext}, ${SDD_PATHS.snapshots}, ${SDD_PATHS.reports},
${SDD_PATHS.usage}, .specs/features).
Existing ${SDD_PATHS.config} is preserved; init never overwrites it. ${SDD_PATHS.usage}
is regenerable toolkit state and is refreshed on every init.

USAGE
  sdd-agentic-flow init [--interactive|--non-interactive] [--language en-US|pt-BR | --en | --br]
                         [--feature-profile small_fix|medium_feature|large_feature|epic]
                         [--preset manual|supervised|autonomous]
                         [--execution-mode plan|guided|apply|review|full]
                         [--autonomy-level manual|supervised|autonomous]
                         [--local-git-exclude] [--quiet] [--ascii]

OPTIONS
  --interactive          Same guided onboarding as default TTY init (includes operating policy).
  --non-interactive      Never prompt; use supplied values and documented defaults.
  --language <profile>   Human-facing output language: en-US or pt-BR.
  --en                   Alias for --language en-US.
  --br                   Alias for --language pt-BR.
  --feature-profile <p>  Adaptive sizing: small_fix | medium_feature | large_feature | epic.
  --preset <p>           Operating policy: manual | supervised | autonomous
                         (aliases: man, assist|assisted, auto).
                         Writes execution_mode and autonomy_level. Cannot combine
                         with --execution-mode or --autonomy-level.
  --execution-mode <m>   What a skill is authorized to do: plan | guided | apply | review |
                         full. Default: guided. See docs/execution-modes.md.
                         Does not accept auto as a synonym of full.
  --autonomy-level <l>   How a workflow advances between skills: manual | supervised |
                         autonomous (aliases: man, assist|assisted, auto).
                         Default: manual. plan/guided never combine with
                         autonomous. See docs/autonomy-levels.md.
  --local-git-exclude    Append ${SDD_ROOT}/ to .git/info/exclude so toolkit state stays out
                         of git status. Applied automatically when installation scope is user;
                         use this flag explicitly for project scope. Does not edit .gitignore
                         and does not exclude .specs/. No-ops with WARN when Git is absent.
  --quiet                Suppress the "Suggested next step" line on success.
  --ascii                Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  Starting a project with this toolkit for the first time, or regenerating
  .sdd-agentic-flow/usage.md without touching an existing config.yml.

EXAMPLES
  sdd-agentic-flow init
  sdd-agentic-flow init --br
  sdd-agentic-flow init --interactive
  sdd-agentic-flow init --preset autonomous
  sdd-agentic-flow init --preset auto
  sdd-agentic-flow init --execution-mode full --autonomy-level supervised
  sdd-agentic-flow init --local-git-exclude
`,
  config: `sdd-agentic-flow config

Inspect or change operating policy (workflow.execution_mode and workflow.autonomy_level only).

USAGE
  sdd-agentic-flow config [show]
  sdd-agentic-flow config policy [--plan] [--yes] [--preset manual|supervised|autonomous]
                                   [--execution-mode plan|guided|apply|review|full]
                                   [--autonomy-level manual|supervised|autonomous]

OPTIONS
  show                 Read-only policy summary (default when no subcommand).
  policy               Change operating policy interactively or with flags.
  --plan               Preview only; never writes.
  --yes                Required for non-interactive mutation.
  --preset <p>         manual | supervised | autonomous

EXAMPLES
  sdd-agentic-flow config show
  sdd-agentic-flow config policy --plan --preset supervised
  sdd-agentic-flow config policy --yes --preset manual
`,
  configure: `sdd-agentic-flow configure

Save installation intent. Unlike \`config\`, which changes only workflow operating
policy, \`configure\` changes the packs, user targets, or project sharing that a later
\`install\` will reconcile. It never installs skills by itself.

USAGE
  sdd-agentic-flow configure [--scope user|project] [--pack <pack>]
                                  [--target agents|cursor|claude|copilot]
                                  [--sharing shared|local] [--plan] [--interactive]

OPTIONS
  --scope user|project  Save user-wide targets or this repository's sharing intent.
  --pack <pack>         Desired pack; repeat for more packs.
  --target <id>         User target: agents, cursor, claude, or copilot; repeatable.
  --sharing shared|local  Project skills are Git-visible or locally excluded.
  --plan                Preview intent and reconciliation; never writes.
  --interactive         Review and edit the saved installation intent.

Useful when:
  You need to change where or how SAF skills are installed before reconciling them.

EXAMPLES
  sdd-agentic-flow configure --pack core --target agents
  sdd-agentic-flow configure --scope project --sharing local
  sdd-agentic-flow configure --plan --pack core
`,
  install: `sdd-agentic-flow install <pack>

Install a skill pack. Defaults to --scope user: writes only to per-agent global
skill directories (e.g. ~/.claude/skills) and creates zero files in the project.
Pass --scope project to install into .agents/skills/ inside the project instead.

USAGE
  sdd-agentic-flow install <pack> [--scope user|project]
                                   [--agent codex|cursor|claude-code|vscode-copilot]
                                   [--plan] [--interactive|--non-interactive] [--quiet] [--ascii]

OPTIONS
  --scope user|project  Install target: global per-agent dirs (default) or the project.
  --agent <name>         Restrict a user-scope install to a single agent's directory.
  --plan                 Print installation plan with preflight summary; no writes.
  --interactive          Guided installation model, targets, preflight, and confirm.
  --non-interactive      Never prompt; use saved intent or documented defaults.
  --quiet                Suppress the "Suggested next step" line on success.
  --ascii                Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  You have run init and need the core (or another) skill pack available to your
  coding agent before planning or implementing work.

EXAMPLES
  sdd-agentic-flow install core
  sdd-agentic-flow install core --plan
  sdd-agentic-flow install core --scope project
  sdd-agentic-flow install core --agent codex

Run \`sdd-agentic-flow list\` to see available packs.
`,
  doctor: `sdd-agentic-flow doctor

Validate local setup: configuration, installed skills (project and user scope),
baselines, language profile, safety defaults, and platform/environment.

USAGE
  sdd-agentic-flow doctor [--json] [--harness] [--smoke] [--contracts] [--autonomy]
                          [--evidence-graph <feature-slug> [--html [--output <path>]]] [--verbose]
                          [--check-updates] [--ascii]

OPTIONS
  --json           Print machine-readable JSON only (no human-readable report).
  --harness        Show repository/project harness readiness from a curated projection
                   of canonical doctor checks; it does not detect the running host.
  --smoke          Also run an isolated init/install/doctor smoke test in a temp dir.
  --contracts      Also validate installed skills' capability contracts.
  --autonomy       Also validate workflow.execution_mode/autonomy_level, the
                   execution_mode × autonomy_level matrix, each installed skill's
                   autonomy_profile support, workflow.autonomy_budget, and the last
                   recorded .sdd-agentic-flow/autonomy/loop-state.md. See docs/autonomy-levels.md.
  --evidence-graph <feature-slug>
                   Read-only v4 evidence graph for one feature under .specs/features/.
                   Recurses only .sdd-agentic-flow/reports for feature-scoped task checks.
  --html           With --evidence-graph, render safe self-contained HTML to stdout.
  --output <path>  With --evidence-graph --html, write HTML only to this explicit path.
  --verbose        With --autonomy, also list all 7 guardrails and what each one gates.
  --check-updates  Make one request to the npm registry to check for a newer version
                   as part of the doctor diagnostic report (read-only). Prefer
                   \`upgrade --check\` for an upgrade-specific read-only check, or
                   \`upgrade\` to install after confirms. See docs/trust-model.md.
  --ascii          Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  You want a read-only health check of config, skills, and safety defaults before
  (or after) an SDD step — or an opt-in npm update check via --check-updates.

EXAMPLES
  sdd-agentic-flow doctor
  sdd-agentic-flow doctor --json
  sdd-agentic-flow doctor --smoke --contracts
  sdd-agentic-flow doctor --autonomy --verbose
  sdd-agentic-flow doctor --check-updates
`,
  upgrade: `sdd-agentic-flow upgrade

Check the npm registry for a newer CLI version and, in an interactive TTY, confirm
before upgrading the global CLI package and/or refreshing managed skills from the
currently executing package. Never silent; never uses --yes.

USAGE
  sdd-agentic-flow upgrade
  sdd-agentic-flow upgrade --check
  sdd-agentic-flow upgrade --plan
  sdd-agentic-flow upgrade --skills-only

OPTIONS
  --check         Upgrade-specific read-only registry check. Never prompts. Never mutates.
  --plan          May access the registry. Prints the concrete CLI + skill plan.
                  Never mutates. Never installs packages. Never overwrites files.
  --skills-only   Never checks the registry. Never changes the CLI package. Refreshes
                  managed skills from the currently executing package only (diff-safe).
  --ascii         Force ASCII symbols (also via SDD_ASCII=1). Presentation only.

Useful when:
  You want to update the toolkit after a new release, or refresh skills after
  \`npx sdd-agentic-flow@latest\` without a silent overwrite of local edits.

EXAMPLES
  sdd-agentic-flow upgrade --check
  sdd-agentic-flow upgrade --plan
  sdd-agentic-flow upgrade
  npx sdd-agentic-flow@latest upgrade --skills-only
`,
  uninstall: `sdd-agentic-flow uninstall

Remove toolkit assets installed by this package. Always preserves
.specs/features, source code, and unknown paths — never removed by any flag.
Requires an explicit --plan or --apply; running with neither fails.

USAGE
  sdd-agentic-flow uninstall --plan
  sdd-agentic-flow uninstall --apply [--include-config] [--full]
                                      [--purge] [--yes]
                                      [--scope user|project]
                                      [--agent codex|cursor|claude-code|vscode-copilot]
                                      [--verbose] [--quiet]

OPTIONS
  --plan                Show only what would be removed; makes no changes.
  --apply                Actually remove the listed assets.
  --include-config       Also remove .sdd-agentic-flow/config.yml (--apply only).
  --full                 Full/clean-reinstall reset (--apply only): also removes
                         .sdd-agentic-flow/context/project-context.md, .sdd-agentic-flow/snapshots, and
                         .sdd-agentic-flow/reports (regenerable state). Implies --include-config.
                         Never removes .specs/features.
  --purge                Cross-scope clean reset: remove all recognized current and legacy SAF
                         state across supported user and project targets. Cannot combine with
                         --scope, --agent, --full, or --include-config. Requires --yes with --apply.
  --yes                  Required for non-interactive destructive apply (--apply --purge).
  --scope user|project  Limit to one scope (default: both).
  --agent <name>         Limit user-scope removal to a single agent's directory.
  --verbose               List every exact removal path after the grouped summary.
  --quiet                Suppress the trailing "preserves ..." explanatory line.

EXAMPLES
  sdd-agentic-flow uninstall --plan
  sdd-agentic-flow uninstall --apply
  sdd-agentic-flow uninstall --apply --include-config
  sdd-agentic-flow uninstall --apply --full
`,
  discover: `sdd-agentic-flow discover

Auto-discover project signals (README, AI instruction files, docs/adr, monorepo
tooling, test/CI/ORM/feature-flag config) into .sdd-agentic-flow/context/project-context.md.
Also run automatically by init. Preserves an existing file unless --force is given.

USAGE
  sdd-agentic-flow discover [--force] [--quiet]

OPTIONS
  --force   Regenerate .sdd-agentic-flow/context/project-context.md even if it already exists.
  --quiet   Accepted for symmetry with the other commands; discover currently has
            no decorative output to suppress.

EXAMPLES
  sdd-agentic-flow discover
  sdd-agentic-flow discover --force
`,
  context: `sdd-agentic-flow context [status|refresh|autonomy-state]

Inspect or refresh the generated project-context artifact's provenance
(when it was generated, at which repository revision/branch), or inspect the
last recorded .sdd-agentic-flow/autonomy/loop-state.md (autonomy_level supervised/autonomous runs).

USAGE
  sdd-agentic-flow context
  sdd-agentic-flow context status
  sdd-agentic-flow context refresh
  sdd-agentic-flow context autonomy-state

Useful when:
  You need to know whether project-context.md is stale after git moves, or to
  inspect the last autonomy loop-state without mutating anything.

EXAMPLES
  sdd-agentic-flow context status
  sdd-agentic-flow context refresh
  sdd-agentic-flow context autonomy-state
`,
  list: `sdd-agentic-flow list

List available skill packs and their status.

USAGE
  sdd-agentic-flow list
`,
  'autonomous-resume': `sdd-agentic-flow autonomous-resume

Resume an autonomy_level supervised/autonomous workflow paused or stopped at a
guardrail. Reads .sdd-agentic-flow/autonomy/loop-state.md, clears any recorded pause=true/
stop=true, and appends an audited log entry. Never re-invokes a skill itself —
this CLI has no orchestration engine; it prints the recorded next skill for the
invoking agent to act on. See docs/autonomy-levels.md.

USAGE
  sdd-agentic-flow autonomous-resume [--force]
  sdd-agentic-flow autonomous-resume --override-guard=<1-7> --reason="..."

OPTIONS
  --force                  Resume without a specific guardrail reference; logs a
                           generic resume entry.
  --override-guard=<1-7>   Reference the specific guardrail (1-7, see
                           docs/autonomy-guardrails.md) being bypassed. Requires --reason.
  --reason="..."           Required with --override-guard: why the override is safe.

EXAMPLES
  sdd-agentic-flow autonomous-resume
  sdd-agentic-flow autonomous-resume --force
  sdd-agentic-flow autonomous-resume --override-guard=3 --reason="flaky test, verified manually"
`,
};

export function writeCommandHelp(key: string): void {
  process.stdout.write(COMMAND_HELP[key] ?? '');
}
