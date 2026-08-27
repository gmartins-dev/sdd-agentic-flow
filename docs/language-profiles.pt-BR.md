# Perfis de idioma

Os perfis de idioma controlam explicações humanas sem traduzir o contrato
técnico do toolkit.

## Perfis disponíveis

| Profile | Saída humana         | Tokens técnicos | Modo bilíngue         |
| ------- | -------------------- | --------------- | --------------------- |
| `en-US` | Inglês               | Inglês canônico | `technical-canonical` |
| `pt-BR` | Português brasileiro | Inglês canônico | `technical-canonical` |

Os arquivos de perfil do shared layer são instalados com o bundle oficial. Eles
orientam explicações, prompts e reports. Comandos, paths, nomes de skills,
chaves de configuração, modos, statuses e identificadores permanecem iguais.

## Selecione um perfil

O perfil padrão é `en-US`. O `init` não cria nem sobrescreve a configuração do
projeto. Adicione um override explícito de `language.profile` em
`.sdd-agentic-flow/config.yml` somente quando o projeto precisar de outro idioma
para saídas humanas.

Override de configuração explícito:

```yaml
language:
  profile: pt-BR
  human_outputs: pt-BR
  technical_tokens: canonical
  bilingual_mode: technical-canonical
```

## Valide o perfil

```bash
npx sdd-agentic-flow doctor
npx sdd-agentic-flow doctor --json
```

O `doctor` mostra uma seção `Language`. O `doctor --json` inclui um objeto
`language` no nível superior com o perfil selecionado e o status da validação.
Projetos legados podem não ter `language.profile`; nesse caso o doctor mostra
`WARN` de compatibilidade e não reescreve o arquivo.

## Política de idioma

A saída humana da CLI segue o perfil selecionado, incluindo prompts interativos, planos,
relatórios do doctor, menus e a saída de aprendizado. Tokens técnicos permanecem canônicos
para manter prompts, paths, statuses e referências de skills compatíveis entre
agentes. Veja a [política de idioma](../shared/references/language-policy.md)
e o [guia de perfis em inglês](language-profiles.md).
