# Environment compatibility

`sdd-agentic-flow` only needs Node.js and a writable filesystem. Git is an optional
integration, never a runtime requirement (see [trust model](trust-model.md)). This table
matches `.github/workflows/ci.yml`, which is the mechanical source of truth — update both
together.

## CLI runtime vs. your project's language

Node.js is a requirement to *run the CLI* (`npx sdd-agentic-flow ...`) — it is not a
requirement for the project you use the CLI in. The CLI only writes Markdown skills and local
config files (`.sdd/config.yml`, per-agent skill directories); it never adds a `package.json`,
`node_modules`, or any language-specific dependency to your project. A Java, PHP, C#, Python,
Go, or Rust project (or any other language) uses `sdd-agentic-flow` exactly the same way a
Node.js project does: run the CLI once via `npx`, then let the installed skills guide the coding
agent inside your project, whatever language it's written in.

## Operating systems

| OS                        | Support level | Verified by                                             |
| --------------------------- | ---------------- | ---------------------------------------------------------- |
| Ubuntu LTS (`ubuntu-latest`) | Required       | CI `check` job, every push/PR, Node 22/24/26                |
| Windows 10/11 (`windows-latest`) | Required   | CI `check-platforms` job, full `npm run check` pipeline    |
| macOS (`macos-latest`)     | Required       | CI `check-platforms` job, full `npm run check` pipeline    |
| Debian-family Linux (Debian, other Ubuntu releases) | Best effort | Not run in CI; follows from "any Node-supported Linux with a POSIX filesystem" |
| Fedora/RHEL-family Linux   | Best effort    | Not run in CI; same principle as above                     |

Principle: Linux is supported whenever it provides a supported Node.js runtime and a
POSIX-compatible filesystem — this is not a closed list of individually tested distributions.

## Node.js versions

| Version | Support level | Verified by                       |
| --------- | ---------------- | ------------------------------------ |
| 22 (Maintenance LTS) | Required | CI `check` job matrix (`ubuntu-latest`); also the Node used in `check-platforms` |
| 24 (Active LTS)      | Required | CI `check` job matrix (`ubuntu-latest`) |
| 26 (Current)         | Required | CI `check` job matrix (`ubuntu-latest`) |

`package.json` declares `"engines": { "node": ">=22" }`, matching the lowest tested version.
Node 18 and 20 reached end of life and were dropped as a compatibility-reducing change in
v1.1.0 (see [compatibility promise](compatibility-promise.md)); Node's own release schedule
is at [nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases).
Node 22+ also removed the underlying cause of most of the CI breakage that motivated this
change: native, unflagged `require()` of ES-module-only packages (`require(esm)`, stable from
Node 22.12), which the CJS tooling in this repo's `devDependencies` chain (`markdown-link-check`
and its own transitive dependencies) needs.

## Shells

None of these are a requirement — the CLI only uses Node.js APIs (`fs`, `path`, `os`,
`child_process` with argument arrays). They are illustrative only, for documentation examples
and for `doctor`'s informational `Shell:` line (`detectShellInfo()` in
`bin/sdd-agentic-flow.js`, which reads `SHELL`/`PSModulePath`/`ComSpec` — never used to change
CLI behavior, and never reported as `FAIL`).

| Shell            | Platform        | Role                              |
| ------------------ | ----------------- | ------------------------------------ |
| bash / zsh / fish | POSIX (Linux, macOS) | Illustrative examples in docs     |
| PowerShell / CMD  | Windows            | Illustrative examples in docs     |
| Git Bash          | Windows            | Illustrative examples in docs     |

## What `doctor` reports

The "Platform" section of `doctor` reports, for the current environment: `OS: <platform>, Node
<version>` (`PASS`), `Filesystem writable` (`PASS`/`FAIL`), `Shell: <detected>` (`INFO`, never
`FAIL`), and `Git: available`/`Git: not available` (`PASS`/`INFO`, never `FAIL` — a missing Git
binary or a non-Git directory both degrade gracefully rather than blocking the command).
