# sdd-agentic-flow

Versão prática em português. Leia o [README principal em inglês](README.md) para a referência completa.

`sdd-agentic-flow` é um toolkit local-first de Spec Driven Development para fluxos com agentes de código. Ele instala skills Markdown no projeto e mantém a decisão final com pessoas.

## Por que confiar?

O código é inspecionável, a CLI tem zero dependências runtime, não usa telemetria, postinstall ou rede externa por padrão, e não faz commit, push, merge, deploy ou publish automaticamente. Use `doctor` e `doctor --smoke` para validação local.

## Início rápido

```bash
npx sdd-agentic-flow@0.3.0 init
npx sdd-agentic-flow@0.3.0 install core
npx sdd-agentic-flow@0.3.0 doctor
```

Use `init --interactive` para escolher as opções iniciais. Packs disponíveis: `core`, `planning`, `execution`, `pr`, `multi-worktree`, `full`, `local-files` e `github`.

Para escolher o perfil de idioma diretamente:

```bash
npx sdd-agentic-flow@0.3.0 init --language en-US
npx sdd-agentic-flow@0.3.0 init --language pt-BR
```

Veja os [perfis de idioma](docs/language-profiles.pt-BR.md) para conhecer o contrato.

## Modos e desinstalação

Os modos documentados são `plan`, `guided`, `apply`, `review` e `full`; todos preservam limites locais e não publicam ou enviam alterações por padrão. Veja [execution modes](docs/execution-modes.md).

```bash
npx sdd-agentic-flow@latest uninstall --plan
npx sdd-agentic-flow@latest uninstall --apply
```

A desinstalação preserva specs, relatórios, snapshots e código-fonte. Use `--include-config` apenas para remover também `.sdd/config.yml`.

## Para quem é indicado?

É indicado para times que usam SDD, entregam features em sprints, usam TDD/test-first, precisam de rastreabilidade e delegam tarefas para agentes com revisão. Não é otimizado para scripts descartáveis, agentes sem revisão humana ou pipelines automáticos de release/deploy.

Para o fluxo completo, consulte o [guia de uso das skills em português](docs/sdd-skills-usage-guide.pt-BR.md) e o [guia em inglês](docs/sdd-skills-usage-guide.md).
