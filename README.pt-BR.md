# sdd-agentic-flow

Versão prática em português. Leia o [README principal em inglês](README.md) para a referência técnica completa.

**sdd-agentic-flow** é um **Spec-Driven Agentic Workflow Harness** local-first e zero-dependência para agentes de código.

Seu agente pode entregar um diff e ainda deixar dúvida se cumpriu a intenção. Este toolkit mantém a especificação, a evidência e a revisão humana no mesmo fluxo.

## O que é o sdd-agentic-flow?

**O sdd-agentic-flow é um Agentic Workflow Harness: um plano de controle de engenharia nativo do repositório que transforma desenvolvimento orientado a especificações em workflows limitados e verificáveis para coding agents.**

Não é só um pacote de Agent Skills. As skills são a camada pública de **capacidade**; o host de agentes de código é dono da execução em runtime. Em volta delas: metodologia, contratos de artefato, baselines, modelo de evidência, configuração, CLI e lifecycle.

O objetivo é engenharia assistida por agentes, estruturada, rastreável e verificável. O modo
autonomous assume a entrega local dentro da autoridade delegada; humanos mantêm autoridade nas
fronteiras de segurança, ações externas, irreversíveis e release.

*O agente faz o trabalho. A especificação define o que deve ser verdadeiro. Sensores fornecem
evidência. O modo autonomous resolve o trabalho ordinário e escala apenas na fronteira de autoridade.*

Fontes que informam este desenho — com papéis epistêmicos, não como specs — estão em [inspirations](docs/inspirations.md).

Specs estruturadas, limites claros e governança humana:

- **Camada de capacidade:** skills Markdown com contrato de capacidade sobre baselines TLC e TDD condensados.
- **Dimensionamento adaptativo:** perfis de feature com contexto de projeto auto-descoberto opcional.
- **Zero footprint por padrão:** instalação user-local; `.sdd-agentic-flow/config.yml` só quando você cria.
- **Humano no loop:** o toolkit estrutura o trabalho do agente; você mantém a autoridade final de revisão.
- **Agnóstico de linguagem:** a CLI roda em Node.js >= 22; seu projeto não precisa ser Node.

Para times que usam coding agents, essa divisão mantém o trabalho de engenharia revisável:
humanos definem a intenção e verificam os resultados; agentes executam dentro do harness. O
projeto não afirma ganhos de tokens ou velocidade sem dados medidos.

Instale e rode com `npx sdd-agentic-flow`: [início rápido](#início-rápido), [guia de uso das skills](docs/saf-skills-usage-guide.pt-BR.md), [jornada do desenvolvedor](docs/developer-journey.md) e [arquitetura](docs/architecture.md).

## O problema

Você delega uma tarefa. O agente pula para o código, mistura limites e marca trabalho como concluído sem prova executável. O tempo de revisão vai reconstruir a intenção a partir do diff — não validar o comportamento.

| Falha comum | Resposta local |
| --- | --- |
| Implementação começa antes de entender os requisitos | `saf-create-spec` e `saf-create-prompts` |
| A tarefa é grande demais para uma mudança controlada | `saf-implement` ou `saf-implement-multi` |
| Saída aceita sem evidência | `saf-check-task` e `saf-validate` |
| PR perde rastreabilidade com a feature | `saf-create-pr`, `saf-review-pr` e `saf-fix-pr` |

Veja [por que o toolkit existe](docs/why-this-exists.md). Para o modelo mental do plano de controle, leia [sdd-agentic-flow model](docs/sdd-agentic-flow-model.md) e [engineering model](docs/engineering-model.md).

## Além dos prompts

A maioria das ferramentas para agentes para em prompts melhores. O **sdd-agentic-flow** explicita a fronteira de engenharia:

| Aspecto | Papel em uma linha |
| --- | --- |
| Prompt | Instruções por skill |
| Context | Specs + contexto de projeto + config |
| Harness | Modos, contratos, safety, evidência |
| Execução do host | Loops, sessões e workers escolhidos pelo host |

**SDD** define o que é “pronto” antes da implementação. SAF define restrições e transições admissíveis; o host executa. Evidence Graph é uma projeção de rastreabilidade somente-leitura, não um grafo de execução. Veja o [engineering model](docs/engineering-model.md).

## A solução

Escreva a spec primeiro. A spec é o contrato entre você e o agente: comportamento, escopo e critérios de aceite ficam em `.specs/features/` antes de alterar código de produção.

Você delega um resultado limitado; o toolkit mantém os contratos de workflow e os gates de evidência.
Manual, supervised e autonomous definem quanto da progressão fica com o agente. Cada fase tem uma
skill Markdown, defaults de segurança locais e artefatos de evidência que você inspeciona. Leia a
[metodologia SDD](docs/sdd-methodology.md) (em inglês) para o panorama completo.

## O que muda para você

| Resultado | Como o toolkit entrega |
| --- | --- |
| Limites de tarefa | Specs, prompts de tarefa e `saf-check-task` por fatia |
| Rastreabilidade | Spec → prompt → código → pacote de PR em uma cadeia |
| Evidência antes de concluir | TDD baseline, check reports, validation reports |
| Entrada mais clara para o agente | Specs escritas e `.sdd-agentic-flow/config.yml` em vez de repetir contexto no chat |
| Trabalho assíncrono | Artefatos versionados em `.specs/` e `.sdd-agentic-flow/` |
| Setup reversível | `uninstall --plan`, escopo de instalação explícito, [modelo de confiança](docs/trust-model.md) |

> [!NOTE]
> Benchmark de token economics: planejado para release futura ([ROADMAP.md](ROADMAP.md)). Este README não cita multiplicadores de token ou velocidade sem dados medidos.

## Início rápido

Requer Node.js >= 22 só para a CLI. Seu projeto não precisa ser Node.js. Veja [compatibilidade de ambiente](docs/environment-compatibility.md).

```bash
npx sdd-agentic-flow
```

Esse é o ponto de entrada humano canônico: ele encaminha primeiro uso, setup existente, setup
parcial e recuperação. A CLI recomenda o lifecycle `install` → `init` → `doctor`; configuração
é opcional. Ela é um **plano de controle** para setup, inspeção e manutenção — não invoca skills.
Veja [O que é SDD?](docs/what-is-sdd.md) e a [referência de comandos](docs/commands.md).

Para automação ou uso avançado, use comandos explícitos como `npx sdd-agentic-flow install`,
`npx sdd-agentic-flow init` e `npx sdd-agentic-flow doctor`. A política padrão efetiva é
`apply + supervised`; use `config policy` somente quando um override explícito for necessário.
**Autonomous não significa autoridade ilimitada.** Commit, push, merge, tag, publish, deploy e
outras ações externas ou irreversíveis continuam fora da delegação. A CLI não executa skills.

Depois, invoque `saf-route` ou abra o [guia de uso das skills](docs/saf-skills-usage-guide.pt-BR.md). Copie uma receita de [prompts](docs/prompt-recipes.md) ao delegar a um agente.

Em um terminal real, `npx sdd-agentic-flow` guia a configuração de compartilhamento, hosts de
agentes, workflow, idioma e profundidade do processo (com **Supervisionado** recomendado ao
pressionar Enter). Para automação, use `init` e comandos `config` explícitos. Veja [início rápido](docs/getting-started.md).

Ao escolher `pt-BR`, a saída humana da CLI — prompts, planos, doctor, menu e `learn-sdd` —
passa a usar português brasileiro. Commands, paths, statuses, IDs e JSON permanecem em inglês
canônico para continuar copiáveis e estáveis.

## Como funciona

**Canonical workflow path:** Plan → Prompt → Implement → Check → PR → Review → Fix → Validate

```mermaid
flowchart TD
  route[saf-route] --> brainstorm[saf-brainstorm]
  brainstorm -->|converged| specs[saf-create-spec]
  route --> specs
  specs -.->|on demand| explain[saf-explain]
  specs --> prompts[saf-create-prompts]
  prompts --> implement[saf-implement]
  prompts -->|dependent tasks| implementmulti[saf-implement-multi]
  implementmulti -->|delegates per task| implement
  implement --> check[saf-check-task]
  check --> pr[saf-create-pr]
  pr --> review[saf-review-pr]
  review -->|findings accepted| fix[saf-fix-pr]
  fix --> review
  review -->|ready| validate[saf-validate]
```

Use `saf-route` quando o próximo passo não estiver claro. Ele recomenda uma skill e aponta para o `SKILL.md` selecionado; não invoca skills nem altera arquivos.

## Comprovado neste repositório

Esses walkthroughs não são claim de slide — rodam como testes de integração em `test/cli.test.ts`. Cada um lista os comandos que o teste executa e o que ele verifica.

| Fluxo | O que comprova | Walkthrough |
| --- | --- | --- |
| Greenfield | Source item até validação | [task-management](examples/golden/task-management/walkthrough.md) |
| Código existente | Specs a partir de código sem docs | [existing-code mode](examples/golden/existing-code-mode/walkthrough.md) |
| Project context | Ciclo `context refresh` / `context status` | [project-context lifecycle](examples/golden/project-context-lifecycle/walkthrough.md) |
| Loop de PR | Create → review → fix → review | [pr-flow](examples/golden/pr-flow/walkthrough.md) |
| Autonomia AUTO-001 | Idea → spec com config autônoma | [autonomy-idea-to-spec](examples/golden/autonomy-idea-to-spec/walkthrough.md) |
| Autonomia AUTO-002 | Cadeia spec → validate | [autonomy-spec-to-validate](examples/golden/autonomy-spec-to-validate/walkthrough.md) |
| Autonomia AUTO-003 | Guardrail pause → resume | [autonomy-guardrail-pause-resume](examples/golden/autonomy-guardrail-pause-resume/walkthrough.md) |
| Autonomia AUTO-004 | Human override (guardrail 3) | [autonomy-human-override](examples/golden/autonomy-human-override/walkthrough.md) |
| Autonomia AUTO-005 | Budget exhaustion (guardrail 6) | [autonomy-budget-exhaustion](examples/golden/autonomy-budget-exhaustion/walkthrough.md) |

O [exemplo task-management](examples/golden/task-management/) mostra uma feature de ponta a ponta. Os fluxos de autonomia comprovam contratos estáticos de continuidade e reparo — não orquestração LLM ao vivo.

## TDD baseline

O toolkit usa um baseline TLC para planejamento e um baseline TDD para implementação. O contrato exigido é evidência comportamental adequada na costura contratual (campo `Public seam`), com resultados atuais gravados. Test-first é recomendado quando afia a spec. O ritual completo RED → GREEN → REFACTOR é opcional e não é prova do harness. Um sensor que passa é evidência, não veredito de correção. Self-report is not evidence. Specs are living control artifacts; rigor follows uncertainty and risk. Detalhe canônico: [TDD baseline](docs/tdd-baseline.md) e [baselines](docs/baselines.md).

## Saiba mais

| Tópico | Doc |
| --- | --- |
| Modelo de engenharia e identidade do produto | [docs/engineering-model.md](docs/engineering-model.md) |
| Jornada ilustrativa do desenvolvedor | [docs/developer-journey.md](docs/developer-journey.md) |
| Metodologia SDD | [docs/sdd-methodology.md](docs/sdd-methodology.md) |
| Arquitetura | [docs/architecture.md](docs/architecture.md) |
| As 12 skills | [docs/skills-catalog.md](docs/skills-catalog.md) |
| Setup por agente | [Codex](docs/using-with-codex.md), [Cursor](docs/using-with-cursor.md), [Claude Code](docs/using-with-claude-code.md), [VS Code + Copilot](docs/using-with-vscode-copilot.md) |
| Política de idioma | [docs/i18n.md](docs/i18n.md) |
| Contribuir | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Para quem é indicado?

Você se encaixa se adota Spec-Driven Development, entrega em sprint com gates de revisão, fatia specs e tarefas como tech lead, delega fatias rastreáveis a agentes, exige evidência comportamental (TDD e test-first continuam estratégias válidas) ou coordena trabalho multi-agente ou multi-task com controle humano.

## Não é otimizado para

Scripts descartáveis, agentes sem revisão humana, pipelines automáticos de release/deploy, ou fluxos que rejeitam specs, limites de tarefa e checkpoints de validação.

<details>
<summary><strong>Referência técnica</strong> (CLI, bundle oficial, skill map, confiança, segurança)</summary>

A referência completa de comandos, bundle oficial, modos de execução, níveis de autonomia, mapa de skills, vocabulário de domínio e limites de segurança está no [README em inglês](README.md) (seção colapsável **Technical reference**).

Resumo de confiança: código inspecionável, zero dependências npm externas em runtime, sem telemetria ou rede por padrão. As bibliotecas de build usadas pela UI rica do terminal são incorporadas ao artefato publicado. As exceções de rede são `doctor --check-updates`, `upgrade` e a pergunta opcional do welcome interativo. O toolkit não faz commit, push, merge, deploy ou publish automaticamente. Por padrão, `install --scope user` não cria arquivos no projeto. Veja [modelo de confiança](docs/trust-model.md) e [escopo de instalação](docs/installation-scope.md).

Desinstalação:

```bash
npx sdd-agentic-flow uninstall --plan
npx sdd-agentic-flow uninstall --yes
```

Veja [desinstalação](docs/uninstall.md) e a [política de compatibilidade](docs/compatibility-promise.md).

</details>
