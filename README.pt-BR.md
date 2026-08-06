# sdd-agentic-flow

Versão prática em português. Leia o [README principal em inglês](README.md) para a referência completa.

`sdd-agentic-flow` é um toolkit local-first e zero-dependência de Spec Driven Development para
fluxos com agentes de código. Ele traz skills Markdown com contrato de capacidades, baselines
condensadas de TLC e TDD, dimensionamento adaptativo por perfil de feature, e contexto de
projeto opcionalmente auto-descoberto. Instala skills e configuração no projeto e mantém a
decisão final com pessoas. Veja a [arquitetura](docs/architecture.md).

## Por que confiar?

O código é inspecionável, a CLI tem zero dependências runtime, não usa telemetria, postinstall ou rede externa por padrão, e não faz commit, push, merge, deploy ou publish automaticamente. Use `doctor` e `doctor --smoke` para validação local.

## Início rápido

```bash
npx sdd-agentic-flow@0.6.0 init
npx sdd-agentic-flow@0.6.0 install core
npx sdd-agentic-flow@0.6.0 doctor
```

Use `init --interactive` para escolher as opções iniciais, incluindo o perfil de feature
(`small_fix`, `medium_feature`, `large_feature`, `epic`). Packs disponíveis: `core`, `planning`, `execution`, `pr`, `multi-worktree`, `full`, `local-files` e `github`. O `init` também
auto-descobre `.sdd/context/project-context.md`; rode `discover [--force]` para atualizar.

Para escolher o perfil de idioma diretamente:

```bash
npx sdd-agentic-flow@0.6.0 init --language en-US
npx sdd-agentic-flow@0.6.0 init --language pt-BR
```

Veja os [perfis de idioma](docs/language-profiles.pt-BR.md) para conhecer o contrato.

## Modos e desinstalação

Os modos documentados são `plan`, `guided`, `apply`, `review` e `full`; todos preservam limites locais e não publicam ou enviam alterações por padrão. Veja [execution modes](docs/execution-modes.md).

```bash
npx sdd-agentic-flow@latest uninstall --plan
npx sdd-agentic-flow@latest uninstall --apply
```

A desinstalação preserva specs, relatórios, snapshots e código-fonte. Use `--include-config` apenas para remover também `.sdd/config.yml`.

## Fluxo principal

Plan → Prompt → Implement → Check → PR → Review → Fix → Validate

Use `sdd-route` quando o próximo passo não estiver claro. Ele apenas recomenda uma skill local e não executa ações automaticamente. Veja o [modelo de invocação](docs/invocation-model.md) e [por que o toolkit existe](docs/why-this-exists.md).

Perfis de idioma definem a saída humana; o glossário de domínio é opcional e registra termos do produto. O `init` não cria esse arquivo automaticamente. Veja [vocabulário de domínio](docs/domain-vocabulary.md).

## TDD baseline

O `sdd-agentic-flow` usa o TLC baseline para planejamento e specs e o TDD
baseline para implementação. O TDD baseline usa testes focados em comportamento,
public seams acordados, ciclos RED → GREEN → REFACTOR e vertical slices. Veja
[TDD baseline](docs/tdd-baseline.md).

## Para quem é indicado?

É indicado para times que usam SDD, entregam features em sprints, usam TDD/test-first, precisam de rastreabilidade e delegam tarefas para agentes com revisão. Não é otimizado para scripts descartáveis, agentes sem revisão humana ou pipelines automáticos de release/deploy.

Para o fluxo completo, consulte o [guia de uso das skills em português](docs/sdd-skills-usage-guide.pt-BR.md) e o [guia em inglês](docs/sdd-skills-usage-guide.md).
