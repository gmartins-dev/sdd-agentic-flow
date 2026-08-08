# FAQ

## Does this require tlc-spec-driven?

No. The package includes an internal adapted baseline.

## Does it modify Git automatically?

No. Its safe defaults keep commits and remote operations manual.

## Can it use a different agent client?

Yes. Skills are Markdown-first and documented for generic and project-local runtimes.

## Does it contact a service?

No. The CLI has no outbound network operation by default.

## Can it remove its files?

Use `uninstall --plan` first. `uninstall --apply` removes only known toolkit assets and preserves project work.

## Does it work with every agent?

No universal guarantee is made. It is Markdown-first and locally installed; see [agent compatibility](agent-compatibility.md).

## How do I know if `project-context.md` is out of date?

Run `sdd-agentic-flow context status`. It reports when the file was generated and at which
repository revision, and states plainly if the repository has changed since — no guessing, just
a factual revision comparison.

## How do I refresh it?

Run `sdd-agentic-flow context refresh` (or `discover --force`, which does the same thing). Both
fully regenerate `project-context.md`, so copy out any manual notes first. Reading the current
revision/branch is a local, read-only `git rev-parse` call; outside a Git repository, or without
`git` installed, this degrades gracefully instead of failing.
