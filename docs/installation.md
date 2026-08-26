# Installation

Requires Node.js 22 or newer for the CLI. Git is required for project-scoped
workspace operations; the toolkit never runs `git init`.

```bash
npx sdd-agentic-flow install
npx sdd-agentic-flow init
npx sdd-agentic-flow doctor
```

`install` copies the 12 official engineering skills and shared references.
There is one bundle and no bundle selector. User scope is the default; project
scope writes `.agents/skills/` in the current project. Repeat `--target` to
select user hosts and use `--plan` for a read-only preview.

`init` prepares only the exact current Git workspace. It writes a minimal local
`saf-workspace/v1` marker, creates project context only when absent, and
reconciles SAF-owned Git exclude blocks. It preserves existing config and does
not reinstall skills. `init --plan` previews the same plan without writing.

`config` is optional. When `.sdd-agentic-flow/config.yml` is absent, SAF uses
the built-in `apply` + `supervised` policy and canonical defaults. Use
`config policy` or `config installation` only to persist explicit overrides.

Recognized pre-v7 state requires an exact reset preview and `--yes` before
deletion. Unknown and future state, foreign skills, `.specs/**`, credentials,
source, documentation, tests, and Git history are preserved.

See [installation scope](installation-scope.md), [configuration](configuration.md),
and [environment compatibility](environment-compatibility.md).
