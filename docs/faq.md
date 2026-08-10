# FAQ

## Does my project need to be a Node.js project?

No. Node.js is required to run the `sdd-agentic-flow` CLI itself, not the project you use it
in. The CLI only installs Markdown skills and local config files; it never adds a
`package.json`, `node_modules`, or a runtime dependency to your project. It works the same way
for Java, PHP, C#, Python, Go, Rust, Node.js, or any other language. See
[environment compatibility](environment-compatibility.md).

## What if I don't have Node.js installed?

Install Node.js >= 22 (see [nodejs.org](https://nodejs.org)) to run the CLI via `npx`. That's
the only supported installation path today; there is no standalone binary that skips Node.js.

## Does this require tlc-spec-driven?

No. The package includes an internal adapted baseline.

## Does it modify Git automatically?

No. Its safe defaults keep commits and remote operations manual.

## Can it use a different agent client?

Yes. Skills are Markdown-first and documented for generic and project-local runtimes.

## Does it contact a service?

No, with one explicit exception: `doctor --check-updates` makes a single request to the npm
registry to check for a newer version, only when you pass that flag. No other command, and no
automatic/background check on any other invocation, ever makes a network call.

## Can it remove its files?

Use `uninstall --plan` first. `uninstall --apply` removes only known toolkit assets and preserves project work.

## Does it work with every agent?

No universal guarantee is made. It is Markdown-first and locally installed; see [agent compatibility](agent-compatibility.md).

## How do I know if `project-context.md` is out of date?

Run `sdd-agentic-flow context status`. It reports when the file was generated and at which
repository revision, and states plainly if the repository has changed since. No guessing, just
a factual revision comparison.

## How do I refresh it?

Run `sdd-agentic-flow context refresh` (or `discover --force`, which does the same thing). Both
fully regenerate `project-context.md`, so copy out any manual notes first. Reading the current
revision/branch is a local, read-only `git rev-parse` call; outside a Git repository, or without
`git` installed, this degrades gracefully instead of failing.
