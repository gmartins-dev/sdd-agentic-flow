# Installation scope

`install` exposes one official bundle at one of two skill scopes. Project
adoption is independent from skill scope.

| Scope | Skill destination | Project skill footprint |
| --- | --- | --- |
| `user` (default) | Selected host directories under the user's home | None |
| `project` | `.agents/skills/` | Official bundle and shared layer |

```bash
npx sdd-agentic-flow install
npx sdd-agentic-flow install --scope project
npx sdd-agentic-flow install --plan
```

Supported user targets are `agents`, `cursor`, `claude`, and `copilot`.
`--target` is repeatable. SAF does not persist credentials or contact a provider
during installation.

`init` has a different boundary: the exact directory from which it is invoked
is the SAF project root, while Git's top level remains independent. Linked
worktrees share adoption identity through canonical common Git metadata and
the project-relative path, but each workspace has its own local marker.

Personal adoption hides toolkit state and specs; Specs shared exposes specs;
Team leaves policy and official assets visible while ignoring only known local
derived state. SAF edits only its own blocks in Git's local exclude file and
never edits `.gitignore`, global excludes, commits, or history.

Use `uninstall --plan` before `uninstall --yes`. Only recognized SAF-owned
paths are removed; unknown and foreign content is preserved.
