# Installation

Install the package, run `npx sdd-agentic-flow init`, then install the smallest pack
that fits the project. Re-running installation preserves existing files.

```bash
npx sdd-agentic-flow@0.2.0 init
npx sdd-agentic-flow@0.2.0 install core
npx sdd-agentic-flow@0.2.0 doctor
```

Use `init --interactive` when selecting initial project defaults. Installation writes only
project-local configuration and selected skills.

Run `npx sdd-agentic-flow list` before installation to inspect pack membership. The installer
writes only under `.agents/skills`; it never downloads or overwrites assets.
