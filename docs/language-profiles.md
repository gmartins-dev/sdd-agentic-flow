# Language profiles

Language profiles control human-facing explanations without translating the
technical contract of the toolkit.

## Available profiles

| Profile | Human output         | Technical tokens  | Bilingual mode        |
| ------- | -------------------- | ----------------- | --------------------- |
| `en-US` | English              | Canonical English | `technical-canonical` |
| `pt-BR` | Brazilian Portuguese | Canonical English | `technical-canonical` |

The shared profile files are installed with the core pack. They define how an
agent should write explanations, prompts, and reports. Commands, paths, skill
names, configuration keys, modes, statuses, and identifiers remain unchanged.

## Select a profile

```bash
sdd-agentic-flow init --language en-US
sdd-agentic-flow init --language pt-BR
sdd-agentic-flow init --interactive --language pt-BR
```

The default profile is `en-US`. `init` does not overwrite an existing
`.sdd/config.yml`; edit that file deliberately when changing a project profile.

Generated configuration has this shape:

```yaml
language:
  profile: pt-BR
  human_outputs: pt-BR
  technical_tokens: canonical
  bilingual_mode: technical-canonical
```

## Validate a profile

```bash
sdd-agentic-flow doctor
sdd-agentic-flow doctor --json
```

`doctor` reports a `Language` section. `doctor --json` includes a top-level
`language` object with the selected profile and validation status. A project
created before v0.3.0 may omit `language.profile`; the doctor reports this as a
compatibility `WARN` and does not rewrite the file.

## Language policy

Human-facing output follows the selected profile. Technical tokens stay
canonical so prompts, paths, statuses, and skill references remain usable
across agent clients. See [the language policy](../shared/references/language-policy.md)
and the [Portuguese profile guide](language-profiles.pt-BR.md).
