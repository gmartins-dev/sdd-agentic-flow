# Installation

Install the package, run `npx sdd-agentic-flow init`, then install the smallest pack
that fits the project. Re-running installation preserves existing files.

```bash
npx sdd-agentic-flow@0.5.0 init
npx sdd-agentic-flow@0.5.0 install core
npx sdd-agentic-flow@0.5.0 doctor
```

Use `init --interactive` when selecting initial project defaults. Installation writes only
project-local configuration and selected skills.

Use `init --language en-US` or `init --language pt-BR` to select a profile without the
interactive prompts. The default is `en-US`.

Run `npx sdd-agentic-flow list` before installation to inspect pack membership. The installer
writes only under `.agents/skills`; it never downloads or overwrites assets.
