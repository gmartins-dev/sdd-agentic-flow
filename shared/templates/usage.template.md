# Skills usage (local stub)

Regenerable toolkit state written by `sdd-agentic-flow init`. This is not a project spec.
Re-running `init` refreshes this file and the bundled usage guides without touching
`.sdd-agentic-flow/config.yml`.

## Main chain

Plan → Prompt → Implement → Check → PR → Review → Fix → Validate

When the next step is unclear, invoke the `saf-route` skill. It recommends one skill from
that chain. It does not run the workflow for you.

## Workflow diagram

{{WORKFLOW_DIAGRAM_SECTION}}

## Full guide

{{FULL_GUIDE_LINKS}}

Validate the installed setup with:

```bash
npx sdd-agentic-flow doctor
```

If `doctor` reports missing skills, install the pack selected in your installation intent.
