# Prompt recipes

## Specify without implementation

```text
Use the installed sdd-create-specs skill to turn this source item into an SDD feature spec. Follow .sdd/config.yml. Do not implement code. Do not create commits. Stop if requirements are ambiguous. Report evidence and limitations.
```

## Review a completed task

```text
Use the installed sdd-task-check skill to review this task against its acceptance criteria. Do not modify files. Report findings, evidence, and limitations.
```

## Apply an approved task

```text
Use the installed sdd-implement-task skill for this approved task. Follow .sdd/config.yml. Make only the authorized local changes. Do not commit, push, merge, deploy, or publish. Run the smallest relevant checks.
```
