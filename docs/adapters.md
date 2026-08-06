# Adapters

`local-files` uses local source items. `github` is guidance for agents that already
have authorized GitHub tooling; the CLI never contacts GitHub. Other tracker adapters
are outside v0.1.

No adapter is required for the core workflow. Source selection remains project-local
and controlled by `.sdd/config.yml`.

As of v0.6.0 this scope is unchanged: adapters stay documentation-level only, with no
network calls, tracker API integrations, or methodological logic. See the
[compatibility promise](compatibility-promise.md).
