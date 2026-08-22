# Adapters

`local-files` uses local source items. No hosted SCM, tracker, or coding-agent provider is a
core SAF dependency; the CLI never contacts one.

No adapter is required for the core workflow. Source selection stays project-local
and controlled by `.sdd-agentic-flow/config.yml`.

Future adapters may publish or consume repository-local SAF artifacts, but they remain optional
edges: no network calls, tracker API integrations, or provider methodology are required by the
core. See the [compatibility promise](compatibility-promise.md).
