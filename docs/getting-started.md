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

Existing installations are replaced with the current v6 contract only through an explicit
clean-slate upgrade or reinstall; repository workflow artifacts are preserved.
For install scopes, custom packs, and collision handling, see
[installation](installation.md).
