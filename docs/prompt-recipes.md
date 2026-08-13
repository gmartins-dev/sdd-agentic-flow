# Prompt recipes

Copy-paste patterns for common SDD steps. Adjust paths and task names to your project.

## Route an unclear request

```text
Use the installed sdd-route skill to recommend the next local SDD skill. Read .sdd-agentic-flow/config.yml and the relevant local artifacts. Do not modify files, install packs, or invoke another skill. State prerequisites and any human decision required.
```

## Specify without implementation

```text
Use the installed sdd-create-specs skill to turn this source item into an SDD feature spec. Follow .sdd-agentic-flow/config.yml. Do not implement code. Do not create commits. Stop if requirements are ambiguous. Report evidence and limitations.
```

## Review a completed task

```text
Use the installed sdd-task-check skill to review this task against its acceptance criteria. Do not modify files. Report findings, evidence, and limitations.
```

## Apply an approved task

```text
Use the installed sdd-implement-task skill for this approved task. Follow .sdd-agentic-flow/config.yml. Make only the authorized local changes. Do not commit, push, merge, deploy, or publish. Run the smallest relevant checks.
```

## Apply an approved code task with TDD evidence

```text
Use the installed sdd-implement-task skill and TDD baseline for this approved code task. Name the required behavior from the spec, confirm the contractual seam (Public seam field), place a sensor that can fail if that behavior is wrong, implement the smallest change, and record current evidence. Test-first is welcome when it sharpens the spec. Full RED → GREEN → REFACTOR is optional; do not fabricate RED. A passing sensor is evidence, not a correctness verdict. Do not commit, push, merge, deploy, or publish.
```

## Check release readiness

```text
Use the installed sdd-release skill after validation passes. Follow .sdd-agentic-flow/config.yml and the repository's version and changelog conventions. Do not create a git tag or run a publish command. Report gaps and the commands a human should run.
```
