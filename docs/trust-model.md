# Trust model

`sdd-agentic-flow` is inspectable local tooling: its CLI, skills, configuration, docs, and validation scripts are part of the package. It has zero runtime dependencies and no telemetry, postinstall hook, or outbound CLI network access by default.

Installation and configuration are explicit local writes to `.agents/skills` and `.sdd/config.yml`. The CLI does not automatically commit, push, merge, deploy, or publish. `doctor`, `doctor --json`, and `doctor --smoke` provide local evidence; publishable files are scanned for blocked private-context markers.

These boundaries do not guarantee correctness or safety for every input or agent. Review generated work, preserve the licensing notices, and keep a human as the final decision maker.
