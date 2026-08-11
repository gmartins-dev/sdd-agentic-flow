# Trust model

`sdd-agentic-flow` is inspectable local tooling: its CLI, skills, configuration, docs, and validation scripts are part of the package. It has zero runtime dependencies and no telemetry, postinstall hook, or outbound CLI network access by default.

The one explicit, opt-in exception is `doctor --check-updates` (v1.4.0): only when that flag is
passed, the CLI makes a single request to the npm registry to check for a newer version, bounded
by a 3-second timeout. No other command makes a network call, and this one never runs
automatically, on any other flag, or on bare invocation. See `bin/update-check.js`.

Installation and configuration are explicit local writes. By default (`install`'s `user`
scope), skills are written only to per-agent global directories outside the project. See
[installation scope](installation-scope.md) for the two scopes and their ownership boundary.
`.sdd-agentic-flow/config.yml` and `.sdd-agentic-flow/context/project-context.md` always live in the project, created
explicitly by `init`/`discover`. The CLI does not automatically commit, push, merge, deploy, or
publish. `doctor`, `doctor --json`, and `doctor --smoke` provide local evidence; publishable
files are scanned for blocked private-context markers.

## Formal product requirements

> **Local-first installation.** The default installation scope MUST be local-only and
> repository-neutral: `install` MUST NOT create, modify, or delete any file inside the
> consumer project unless repository integration is explicitly requested via `--scope project`.
>
> **Cross-platform, shell-independent.** `sdd-agentic-flow` MUST provide a consistent
> installation and usage experience across supported Windows, macOS, and Linux environments,
> without requiring a specific interactive shell. The CLI MUST NOT rely on Bash, Zsh,
> PowerShell, CMD, or other shell-specific behavior for core functionality. Only Node.js APIs
> (`fs`, `path`, `os`, `child_process` with argument arrays, never shell-string interpolation)
> may drive core behavior. Shell-specific commands MAY appear in documentation as illustrative examples, but product
> behavior MUST NOT depend on them.
>
> **Git is an optional integration capability, not a runtime requirement.** Node.js is
> required; Git is not. Where the CLI reads Git state (repository revision/branch), absence of
> Git or of a Git repository MUST degrade gracefully, never fail the command.

See [environment compatibility](environment-compatibility.md) for the supported OS/Node/shell
matrix this promise is checked against.

The TLC and TDD baselines are local references. They guide planning and code-task
evidence without installing an external methodology package.

These boundaries do not guarantee correctness or safety for every input or agent. Review generated work, preserve the licensing notices, and keep a human as the final decision maker.
