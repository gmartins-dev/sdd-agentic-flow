# Installation scope

`install` exposes one official bundle at one of two skill scopes. Project
adoption is independent from skill scope.

User installation and workspace setup are independent lifecycle stages:
`install --scope user` does not require Git, while `init` and project adoption
operate only on the current Git workspace. A healthy user installation outside
Git is valid even when no workspace profile exists yet.

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

Personal adoption keeps toolkit state and specs local. Specs shared exposes only
the configured SAF specs root. Team keeps project skills and durable project
configuration visible, while specs remain local by default and can be shared
only through an explicit choice. Other generated SAF state stays local in every
mode. SAF edits only its own blocks in Git's local exclude file and never edits
`.gitignore`, global excludes, commits, or history.

Local visibility means that SAF excludes new files from Git and reports a
conflict when the configured root is already tracked. It does not remove files
from the Git index and does not make local files invisible to coding agents.

Use `uninstall --plan` before `uninstall --yes`. Only recognized SAF-owned
paths are removed; unknown and foreign content is preserved.
