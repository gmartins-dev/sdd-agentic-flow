# Contributing

Keep changes small, documented, and covered by `npm run check` and `npm run sanitize`.

The local test suite shells out to the system `tar` CLI for one packaging-boundary test (it
extracts a real `npm pack` tarball and runs the extracted CLI); that test skips itself if `tar`
is not on `PATH`.

no postinstall: do not add a runtime dependency, `postinstall`, network-by-default behavior, a required
AI client, programming language, or framework without an explicit project decision.
Do not weaken the TLC baseline, safety defaults, attribution, licensing, or privacy
policy. Never add private context to docs, fixtures, examples, or tests.
