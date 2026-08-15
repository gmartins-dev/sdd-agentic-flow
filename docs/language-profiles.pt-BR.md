# Perfis de idioma

Os perfis de idioma controlam explicações humanas sem traduzir o contrato
técnico do toolkit.

## Perfis disponíveis

| Profile | Saída humana         | Tokens técnicos | Modo bilíngue         |
| ------- | -------------------- | --------------- | --------------------- |
| `en-US` | Inglês               | Inglês canônico | `technical-canonical` |
| `pt-BR` | Português brasileiro | Inglês canônico | `technical-canonical` |

Os arquivos de perfil do shared layer são instalados com o pack `core`. Eles
orientam explicações, prompts e reports. Comandos, paths, nomes de skills,
chaves de configuração, modos, statuses e identificadores permanecem iguais.

## Selecione um perfil

```bash
sdd-agentic-flow init --language en-US
sdd-agentic-flow init --language pt-BR
sdd-agentic-flow init --interactive --language pt-BR

# --en e --br são atalhos para as duas formas de --language acima
sdd-agentic-flow init --en
sdd-agentic-flow init --br
```

O perfil padrão é `en-US`. O `init` não sobrescreve `.sdd-agentic-flow/config.yml`
existente. Altere esse arquivo deliberadamente para mudar o perfil do projeto.

Configuração gerada:

```yaml
language:
  profile: pt-BR
  human_outputs: pt-BR
  technical_tokens: canonical
  bilingual_mode: technical-canonical
```

## Valide o perfil

```bash
sdd-agentic-flow doctor
sdd-agentic-flow doctor --json
```

O `doctor` mostra uma seção `Language`. O `doctor --json` inclui um objeto
`language` no nível superior com o perfil selecionado e o status da validação.
Projetos criados antes da v0.3.0 podem não ter `language.profile`; nesse caso o
doctor mostra `WARN` de compatibilidade e não reescreve o arquivo.

## Política de idioma

A saída humana da CLI segue o perfil selecionado, incluindo prompts interativos, planos,
relatórios do doctor, menus e a saída de aprendizado. Tokens técnicos permanecem canônicos
para manter prompts, paths, statuses e referências de skills compatíveis entre
agentes. Veja a [política de idioma](../shared/references/language-policy.md)
e o [guia de perfis em inglês](language-profiles.md).
