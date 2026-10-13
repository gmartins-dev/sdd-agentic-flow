# Desenvolvimento orientado a aceite

O SAF é Spec-Driven Development. Ele aproveita o que há de útil em ATDD, BDD e TDD e não exige
nenhum runner. Esta página explica como as peças se relacionam e o que a v8.4.0 acrescenta para
tornar os critérios de aceite rastreáveis. As regras canônicas ficam em
[artifact-contracts.md](../shared/references/artifact-contracts.md) e
[evidence-standard.md](../shared/references/evidence-standard.md).

## Como as disciplinas se mapeiam

| Ideia | Onde vive no SAF |
| --- | --- |
| Humanos decidem o que deve ser verdade | `spec.md`: requisitos e critérios de aceite, confirmados por um humano |
| Exemplos concretos afinam um critério | Bloco opcional `Examples:` sob o critério |
| Verificações executáveis vinculam o agente | Sensores num seam contratual, registrados como evidência `EV-*` |
| Test-first como estratégia | Opcional; RED nunca é prova ([baseline de TDD](tdd-baseline.md)) |
| Por quê → o quê → como | `saf-brainstorm` (por quê) → `spec.md` (o quê) → `design.md` e `tasks.md` (como) |

O SAF não exige Gherkin, arquivos `.feature` nem um framework de testes. Quem já usa Gherkin pode
marcar cenários com o ID do critério, por exemplo `@AC-01`; o SAF não verifica essa tag.

## Identidade do critério de aceite

Um critério pode ter um ID estável ligado a exatamente um requisito:

```markdown
## Acceptance criteria

- AC-01 (REQ-01): marcar uma tarefa pendente como concluída reduz o contador em 1.
  Examples:
  - Given 3 tarefas pendentes, When a usuária conclui uma, Then o contador mostra 2.
```

Anchors de tarefa, prompts e registros de evidência podem citar `AC-*` no campo existente
`Requirement anchors`; um anchor de AC implica o requisito pai. Os IDs são únicos na feature e
nunca são reutilizados. Sem IDs `AC-*`, tudo funciona por requisito, como antes.

Given/When/Then é notação opcional. O obrigatório é o resultado observável. Confirme os critérios
em prosa primeiro e escreva os exemplos depois: exemplos com cara de teste transformam a revisão
em checagem de sintaxe. Um critério com risco de segurança, permissão ou dados inclui um exemplo do
que **não** pode acontecer.

## Cobertura por critério

`npx sdd-agentic-flow doctor --evidence-graph <feature>` lista cada critério sob o seu requisito
quando a spec usa `AC-*`, em texto, `--json` (`acceptance_criteria`) e `--html`. Um requisito só
está coberto quando todos os seus critérios estão. Estes casos saem com código `1`:

| Caso | Significado |
| --- | --- |
| `duplicate-ac-id` | O mesmo ID `AC-*` foi declarado duas vezes |
| `ac-unknown-requirement` | O critério aponta para um requisito que a spec não declara |
| `unknown-ac-anchor` | Uma tarefa ancora um `AC-*` que a spec não declara |
| `no-ac-evidence` | O critério não tem evidência atual aprovada |

Uma linha que parece critério, mas não segue o formato, vira `malformed AC line` e nunca conta
como cobertura.

## Mudar um sensor que codifica um critério

Um sensor que codifica um critério aprovado é a expectativa congelada. As mudanças são
classificadas:

| Classe | Permitida |
| --- | --- |
| `infrastructure repair` | Sim: setup, fixture, ambiente, seletor, timing |
| `automation repair` | Sim: como o comportamento aprovado é exercitado |
| `contract correction` | Só após decisão humana (decision gate) e atualização da spec |
| `contract weakening` | Não: proíbe `pass` e `ready` |

Isso separa consertar um teste de mudar em silêncio o que o teste exige. Check e review também
sinalizam comportamento órfão, isto é, código ou testes sem critério.

## O que o SAF deliberadamente não faz

- Não prescreve o ritual de TDD. Um experimento publicado de loop de agente (amostra pequena, juiz LLM) não
  viu ganho de qualidade ao prescrever red-green-refactor, com custo muito maior em tokens. O SAF
  trata isso como evidência fraca, não como prova, e mantém RED opcional e nunca prova. Quando RED é registrado, a causa é rotulada para
  que um teste quebrado não seja confundido com comportamento ausente.
- Não roda testes, não faz mutação de código e não adiciona um modelo verificador. O CLI
  diagnostica; as skills verificam.
- Não alega melhoria no comportamento dos agentes. Os fixtures da v8.4.0 provam que uma checagem
  distingue reparo de mudança de contrato; uma campanha em host real é uma decisão à parte.

## Relacionados

- [Metodologia SDD](sdd-methodology.md)
- [Baseline de TDD](tdd-baseline.md)
- [Avaliação de comportamento de skills](skill-behavior-evaluation.md)
- [Comandos](commands.md)
