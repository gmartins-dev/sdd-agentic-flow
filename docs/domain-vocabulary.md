# Domain vocabulary

Language profiles control human-facing output language. A domain glossary records product terms as a separate, optional local artifact.

Use `.sdd/context/domain-glossary.md` only when explicitly authorized. `init` does not create it automatically. Setup or specification work may propose or create it after explicit authorization.

When it exists, specs, prompts, implementation, checks, and validation should read it. Add or change a term only with a source or an explicit uncertainty note. Do not place private data, secrets, or unsupported claims in the glossary.

Start from [the glossary template](../shared/templates/domain-glossary.template.md).
