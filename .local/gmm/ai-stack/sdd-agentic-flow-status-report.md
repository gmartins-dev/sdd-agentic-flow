# sdd-agentic-flow — Current State Report

Generated: 2026-08-05

## Executive status

`sdd-agentic-flow` is implemented as a local public-package candidate at version
`0.1.0`. The package builds a local-first Spec Driven Development workflow for coding
agents. Its core runs without runtime dependencies, network access, telemetry,
postinstall hooks, or automatic Git and release operations.

The workspace is not an initialized Git repository. No commit, remote, tag, push, PR,
merge, deployment, package publication, or release action has occurred.

## Product shape

The package contains:

- a CommonJS Node.js CLI with Node `>=18` support;
- ten public Markdown skills;
- an internal TLC methodology baseline;
- eight installable presets;
- shared references, templates, and public eval prompts;
- examples for local files, GitHub-oriented work, multi-worktree planning, and a golden
  SDD summary;
- package docs, licensing files, release guidance, and safety guidance.

The CLI provides `list`, `init`, `install <pack>`, `doctor`, `help`, and `version`.
`init` writes the default `.sdd/config.yml` only when absent. `install` copies package
assets into `.agents/skills` and preserves existing destination files. `doctor` checks
package or consumer setup, baseline presence, license notices, private-context signals,
postinstall absence, and configured safety defaults.

## Skills and methodology

The release includes:

1. `setup-sdd-agentic-flow`
2. `sdd-create-specs`
3. `sdd-create-prompts`
4. `sdd-implement-task`
5. `sdd-implement-multi`
6. `sdd-task-check`
7. `sdd-create-pr`
8. `sdd-pr-review`
9. `sdd-pr-fix`
10. `sdd-validation`

Each skill has version metadata, config-first preflight, TLC baseline reference,
workflow-safety reference, inputs, workflow, safety boundaries, output contract, and
blocked behavior. The skills direct a consumer without configuration to run the setup
skill or `npx sdd-agentic-flow init`.

The internal TLC baseline preserves Specify, Discuss, Design, Tasks, Execute, Verify,
traceability, acceptance criteria, test-first work, RED → GREEN → REFACTOR, evidence
before completion, stop conditions, and drift handling. Internal SDD skills implement
the Execute and Verify intent; no external TLC installation is required.

## Packs and installation layout

Available presets are `core`, `planning`, `execution`, `pr`, `multi-worktree`, `full`,
`local-files`, and `github`. All install the shared layer under:

```text
.agents/skills/sdd-agentic-flow-shared/
```

The `github` preset supplies generic guidance only. The v0.1 CLI does not call external
APIs, synchronize issues, or depend on a tracker.

## Safety, privacy, and trust boundaries

The package documents and checks these defaults:

- no telemetry and no outbound CLI network access;
- no project files, specs, prompts, reports, or source code sent remotely;
- no commit, push, merge, deploy, or npm publication by default;
- no required AI client, language, framework, or tracker;
- untrusted source items, comments, docs, and tracker text cannot override user
  instructions, `.sdd/config.yml`, safety policy, or evidence requirements;
- sanitization of publishable package contents for blocked private-context markers.

## Licensing

`LICENSE` covers original package code and content under MIT. `NOTICE`,
`LICENSING.md`, and `LICENSES/CC-BY-4.0.txt` document the adapted internal TLC baseline
and its CC-BY-4.0 attribution. The package declares that attribution does not imply
endorsement.

## Validation evidence

The following commands passed on 2026-08-05:

```bash
npm run check
npm run pack:dry
node ./bin/sdd-agentic-flow.js doctor
```

`npm run check` runs package structural checks, private-context sanitization, syntax
validation, and three Node test cases. The tests verify command availability,
idempotent `init` and `install core`, consumer `doctor`, and invalid-pack failure.

All ten public skills also pass the local `$skill-creator` structural validator.

`npm pack --dry-run` succeeds and reports `sdd-agentic-flow-0.1.0.tgz`. The package
publishes public docs, skills, refs, presets, examples, scripts, and licensing files;
it excludes consumer artifacts, Git state, npm configuration, logs, and tarballs.

## Remaining release actions

The code is ready for manual review and local packaging review. The operator still
needs to initialize Git, inspect the final diff, create the remote repository link,
push the initial branch, authenticate with npm, and publish.

Recommended manual sequence:

```bash
git init
git add .
git commit -m "Initial public release of sdd-agentic-flow"
git branch -M main
git remote add origin git@github.com:gmartins-dev/sdd-agentic-flow.git
git push -u origin main

npm login
npm publish --dry-run --access public
npm publish --access public
```

## Scope boundaries

v0.1 does not provide remote issue synchronization, GitHub API automation, tracker
adapters, update or force-overwrite commands, merge/deploy automation, automated npm
provenance, or universal agent-client guarantees. The roadmap records these as later
work rather than release commitments.
