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
→ saf-brainstorm (somente para ideias ainda incertas)
→ saf-create-spec
→ saf-create-prompts
→ saf-implement ou saf-implement-multi
→ saf-check-task por tarefa
→ saf-create-pr → saf-review-pr → saf-fix-pr (quando solicitado)
→ saf-validate
```

No fluxo multi-task, a execução sequencial é o fallback. Paralelismo exige
autorização explícita para worktrees, concorrência no host e fronteiras mutáveis
sem sobreposição. O host cria e gerencia worktrees e aplica a semântica de
inicialização antes de iniciar cada worker.

As skills não concedem autoridade para commit, push, merge, release, deploy,
publish, persistência de credenciais ou serviços externos.

Veja [instalação](installation.md), [modelo de confiança](trust-model.md),
[modos de execução](execution-modes.md) e [modelo de segurança](safety-model.md).
