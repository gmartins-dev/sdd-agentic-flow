# Getting started

Run one command in the project you want to prepare:

```bash
npx sdd-agentic-flow init
```

In a real terminal, guided onboarding configures the project, installs the `full`
pack for you by default, asks how SAF should operate (Supervised is recommended),
creates project context, and runs `doctor`. Press Enter to choose the recommended
setup and operating policy, review once, and apply. Choose **Customize setup** when
you need a different pack, scope, skill targets, project sharing, or policy.
Use explicit `config` commands and `--yes` for scripted mutations.

## Use a scripted setup

Outside a real TTY, `init` writes configuration and generated context but does not run the
guided installer. Use explicit commands when a script or CI job prepares a project:

```bash
npx sdd-agentic-flow init --preset manual
npx sdd-agentic-flow install full
npx sdd-agentic-flow doctor
```

`manual` is the fail-safe policy for non-interactive setup. Replace it with `supervised` or
`autonomous` only when the project has deliberately chosen that authority level. Use
`config installation --plan` or `install full --plan` to inspect paths before writing them.

## Check the result

Run `doctor` after installation. It reports the package, filesystem, project context, skill
contracts, and autonomy checks that apply to the current project. Use `doctor --json` when a
script needs a versioned machine-readable result. If a check returns `WARN` or `FAIL`, start
with [troubleshooting](troubleshooting.md).

Existing installations are replaced with the current contract only through an explicit
clean-slate upgrade or reinstall; repository workflow artifacts are preserved.
For install scopes, custom packs, and collision handling, see
[installation](installation.md).
