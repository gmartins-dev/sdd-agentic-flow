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
Use `--non-interactive` in scripts and CI.

Existing `core` installations remain unchanged until you explicitly change setup.
For install scopes, custom packs, and collision handling, see
[installation](installation.md).
