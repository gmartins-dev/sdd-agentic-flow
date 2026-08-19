# Guia de uso das skills (stub local)

Estado regenerável do toolkit, escrito por `sdd-agentic-flow init`. Isto não é uma spec do projeto.
Reexecutar `init` atualiza este arquivo e os guias locais sem alterar `.sdd-agentic-flow/config.yml`.

## Cadeia principal

Plan → Prompt → Implement → Check → PR → Review → Fix → Validate

Quando o próximo passo não estiver claro, invoque a skill `saf-route`. Ela recomenda uma skill
dessa cadeia. Ela não executa o fluxo por você.

SAF define restrições de workflow e transições admissíveis. O host de agentes de código executa.
As evidências atuais apoiam a verificação antes que o trabalho avance. Leia a jornada canônica:
<https://github.com/gmartins-dev/sdd-agentic-flow/blob/main/docs/developer-journey.md>.

## Diagrama do fluxo

{{WORKFLOW_DIAGRAM_SECTION}}

## Guia completo

{{FULL_GUIDE_LINKS}}

Valide a instalação com:

```bash
npx sdd-agentic-flow doctor
```

Se `doctor` reportar skills ausentes, instale o pack selecionado na sua intenção de instalação.
