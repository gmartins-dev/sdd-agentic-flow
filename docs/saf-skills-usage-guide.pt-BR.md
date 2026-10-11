# Guia de uso das skills SDD

O SAF define restrições do workflow e transições de evidência; o host do agente
executa o trabalho. Instale o bundle oficial uma vez, inicialize cada workspace
Git e configure apenas quando os defaults precisarem de override.

```bash
npx sdd-agentic-flow install
npx sdd-agentic-flow init
npx sdd-agentic-flow doctor
```

A ausência de `.sdd-agentic-flow/config.yml` é saudável. As skills usam os
defaults canônicos `apply` + `supervised`, `.specs/features/`, fontes locais e
os gates documentados. Configuração inválida ou futura falha de forma fechada.

## Workflow

```text
saf-route
→ saf-brainstorm (somente para ideias ainda não resolvidas)
→ saf-create-spec
→ saf-create-prompts
→ saf-implement ou saf-implement-multi
→ saf-check-task por tarefa
→ saf-create-pr → saf-review-pr → saf-fix-pr (quando autorizado) → nova revisão
→ saf-validate
```

Use `saf-route` quando a próxima transição de estado não estiver clara. A ausência de um artefato
semântico continua bloqueando quem o consome; a ausência de configuração opcional, não. Uma tarefa
explícita e elegível pode ir direto para a implementação. Use `saf-explain` para explicar um
trabalho existente; esse pedido não autoriza execução.

Use `saf-brainstorm` para um problema indefinido, uma direção de produto relevante ainda não
resolvida ou uma investigação de viabilidade pedida explicitamente. Um resultado delimitado e
observável pode ir direto para `saf-create-spec`, mesmo com decisões técnicas comuns em aberto.

Para várias tarefas, `saf-implement-multi` deriva ondas de dependência e executa em sequência por
padrão. Paralelismo exige autoridade explícita para worktrees, concorrência no host e fronteiras
mutáveis sem sobreposição. O host cria e gerencia as worktrees; cada workspace criado recebe a
semântica de inicialização compartilhada antes de o worker começar.

As skills não concedem autoridade para commit, push, merge, release, deploy, publish, persistência
de credenciais ou serviços externos. Essas ações exigem autorização explícita separada.

## Revisão local e nova revisão

`saf-create-pr` prepara um pacote local; `saf-review-pr` avalia o diff e a evidência de uma
tarefa; `saf-fix-pr` corrige findings verificados dentro do escopo autorizado. No modo autônomo, a
delegação delimitada original pode autorizar essas transições locais. Um PR remoto não é
necessário, e a saída da revisão não publica um.

As revisões mantêm os IDs dos findings entre correções e prestam contas de todo ID anterior numa
tabela de resolução. A etapa de correção fornece a evidência; a nova revisão confirma a resolução.
Evidência ausente e um problema que não foi reproduzido continuam visíveis, e um adiamento não
significa que o problema foi corrigido. Veja o
[protocolo de revisão](../shared/references/reviewability.md).

A evidência identifica a revisão inspecionada e distingue inspeção local, reprodução e fontes
externas oficiais aplicáveis. Pesquisa externa exige permissão existente; pesquisa indisponível é
uma lacuna. Os checks precisam cobrir os requisitos e estados nomeados, não apenas reportar uma
suíte verde. Checks estruturais de corpus não certificam o comportamento de um host. Veja o
[padrão de evidência](../shared/references/evidence-standard.md).

A partir da v8, os checks de tarefa e a validação da feature persistem o contrato de evidência v1
delimitado. A migração é por reexecução: atualize o SAF, rode de novo os checks e a validação e
depois inspecione o Evidence Graph; reports legados continuam como contexto histórico.

Quando o trabalho é retomado a partir de um handoff não terminal, o handoff é contexto de apoio, não
um substituto para a feature, a tarefa, a configuração, a spec, os decision gates ou o estado da
implementação canônicos. `saf-implement` restabelece esses artefatos, depois resolve um report v8
referenciado pela identidade e pelo escopo publicados e verifica de novo a validade e a atualidade
das entradas declaradas. Um sucessor positivo atual pode informar as regras de transição
existentes; evidência ausente, legada, ambígua, negativa, malformada, desatualizada ou
inconclusiva não estabelece conclusão. Caminhos, nomes de arquivo, timestamps e narrativa do
handoff nunca selecionam a evidência ativa.

Veja [instalação](installation.md), [modelo de confiança](trust-model.md),
[modos de execução](execution-modes.md) e [modelo de segurança](safety-model.md).
