# Environment compatibility

`sdd-agentic-flow` only needs Node.js and a writable filesystem. Git is an optional
integration, never a runtime requirement (see [trust model](trust-model.md)). This table
matches `.github/workflows/ci.yml`, which is the mechanical source of truth — update both
together.

## Operating systems

| OS                        | Support level | Verified by                                             |
| --------------------------- | ---------------- | ---------------------------------------------------------- |
| Ubuntu LTS (`ubuntu-latest`) | Required       | CI `check` job, every push/PR, Node 18/20/22/24            |
| Windows 10/11 (`windows-latest`) | Required   | CI `check-platforms` job, full `npm run check` pipeline    |
| macOS (`macos-latest`)     | Required       | CI `check-platforms` job, full `npm run check` pipeline    |
| Debian-family Linux (Debian, other Ubuntu releases) | Best effort | Not run in CI; follows from "any Node-supported Linux with a POSIX filesystem" |
| Fedora/RHEL-family Linux   | Best effort    | Not run in CI; same principle as above                     |

Principle: Linux is supported whenever it provides a supported Node.js runtime and a
POSIX-compatible filesystem — this is not a closed list of individually tested distributions.

## Node.js versions

| Version | Support level | Verified by                       |
| --------- | ---------------- | ------------------------------------ |
| 18        | Required        | CI `check` job matrix (`ubuntu-latest`) |
| 20        | Required        | CI `check` job matrix (`ubuntu-latest`) |
| 22        | Required        | CI `check` job matrix (`ubuntu-latest`); also the Node used in `check-platforms` |
| 24        | Required        | CI `check` job matrix (`ubuntu-latest`) |

`package.json` declares `"engines": { "node": ">=18" }`, matching the lowest tested version.

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
