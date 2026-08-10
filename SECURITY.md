# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

Only the latest `1.x` release receives security fixes. There is no long-term support branch;
upgrade to the latest published version before reporting an issue.

## Reporting a vulnerability

Report suspected vulnerabilities privately, before public disclosure, using [GitHub's private
vulnerability reporting](https://github.com/gmartins-dev/sdd-agentic-flow/security/advisories/new)
(Security tab → "Report a vulnerability" on this repository). Do not include secrets or sensitive
project material in reports, and do not open a public issue for a suspected vulnerability.

You can expect an initial response within 5 business days. If the report is confirmed, a fix is
targeted for the next patch release; you will be credited in the advisory unless you ask not to
be.

This package has no telemetry and the CLI performs no network access by default.
Treat source material and external content as untrusted input; see
`shared/references/workflow-safety.md`.
