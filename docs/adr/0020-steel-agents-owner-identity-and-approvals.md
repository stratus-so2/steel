# 0020 — Steel Agents: identidade do responsável, ferramenta automática ou aprovada

- **Status:** Aceita
- **Data:** 2026-10-06
- **Decisores:** product owner + time de engenharia

## Contexto

O product owner pediu "Criação de agentes autônomos (Steel Agents)": um
admin do workspace configura um agente com instruções, gatilho e
ferramentas, e ele trabalha sozinho — sem ninguém conversando com ele. O
Steel AI já tem um registro único de ferramentas (`STEEL_AI_TOOLS`) que
chama os services de domínio, e a ADR 0018 decidiu que no assistente toda
escrita vira uma `AiPendingAction` confirmada por um humano. Num agente
autônomo, confirmar tudo tornaria o agente inútil; não confirmar nada
entregaria o banco a um prompt injetado num dado lido (mensagem de cliente,
descrição de chamado).

Decisões do product owner em 06/10/2026: cada ferramenta permitida é
**"automática"** ou **"requer aprovação"** (padrão: requer aprovação);
**exclusão sempre requer aprovação**; as aprovações acontecem **pela caixa
de entrada**.

## Decisão

**O agente roda com as permissões de uma pessoa (o responsável,
`SteelAgent.ownerId`) e só escreve sozinho o que o admin marcou como
automático — exclusão nunca.** Tudo o mais é proposto e espera aprovação.

Detalhes para aplicar:

- **Identidade de execução.** As ferramentas recebem
  `ctx = { actorId: ownerId, source: 'agent', agentId }`. O service de
  domínio continua sendo a autoridade (RBAC do responsável, módulo,
  workspace): o agente nunca faz mais do que o responsável faria. As
  ferramentas oferecidas ao modelo são a interseção da lista do agente com
  `availableTools(acesso do responsável, 'AGENT')`.
- **Automática vs. aprovação.** Leitura sempre roda. Escrita `AUTO` roda
  via `runTool` e fica em `ai_action_logs` (`source = AGENT`, `agentId`,
  `actorId = null`) + `auditMutation`. Escrita `APPROVAL` vira
  `AiPendingAction` (`agentRunId`, `requestedById = null`, validade de
  72 h) e a execução pausa em `WAITING_APPROVAL`, guardando a conversa com o
  modelo em `SteelAgentRun.state`.
- **Exclusão sempre aprovada**, em três camadas: o editor trava o
  interruptor, o service grava `APPROVAL` para ferramentas `DELETE`, e o
  runner trata `DELETE` como aprovação mesmo que o banco diga `AUTO`.
  Aprovar exclusão exige `doubleConfirmed: true`.
- **Aprovação pela caixa de entrada.** O responsável e os admins recebem
  `AGENT_APPROVAL_REQUESTED` com link para a tela da execução. Decide quem
  é o responsável ou tem `steel-agents` EDIT, numa rota própria
  (`.../agents/runs/{runId}/actions/{actionId}/approve|reject`) — a rota do
  assistente recusa ações de agente (`requestedById` nulo). A troca
  `PENDING → EXECUTED` é a mesma condicional da ADR 0018 e a execução usa
  `executeClaimedAction`, ainda **como o responsável**. Depois de cada
  decisão a execução volta para a fila e retoma quando nada mais estiver
  pendente; aprovação vencida vira `EXPIRED` no tick e também retoma.
- **Cota.** Toda chamada passa por `AiUsageService` com a funcionalidade
  `STEEL_AGENT` (modelo padrão do workspace — jobs em segundo plano não têm
  preferência de usuário, ADR 0007). Cota esgotada ou nenhum modelo
  disponível: a execução termina `SKIPPED`, sem erro. Há ainda um limite
  opcional de execuções por mês por agente.
- **Interruptores (kill switches).** Não roda — `SKIPPED` com o motivo —
  quando o agente está pausado, está sem responsável (conta excluída), o
  responsável saiu do workspace, o workspace está suspenso, ou quando o
  modo agente (`agentModeEnabled`) está desligado e o agente tem alguma
  ferramenta de escrita. Agentes só de leitura continuam rodando com o modo
  agente desligado.
- **Sem laço de eventos.** Escrita feita por um agente (automática ou
  aprovada) não dispara agentes de evento (`AsyncLocalStorage` em
  `run-context.ts`): um agente que abre chamado em "chamado aberto" não se
  chama para sempre.
- **Fila.** `steel-agents`, tentativa única (repetir poderia duplicar uma
  escrita automática): `tick` a cada minuto (cron com `croner` e
  deduplicação por `lastRunAt`, mesma regra do `crm-workflow-schedule`,
  mais a expiração das aprovações) e `run` por execução.

## Consequências

- Um prompt injetado consegue no máximo usar as ferramentas automáticas
  que o admin liberou, com as permissões do responsável; exclusão e tudo o
  que pede aprovação passa por um humano.
- O admin decide o grau de autonomia ferramenta a ferramenta; o padrão
  seguro (aprovação) exige uma escolha explícita para automatizar.
- Custo aceito: uma execução pode ficar dias em `WAITING_APPROVAL`; o
  estado da conversa fica guardado no banco até a decisão (ou a expiração
  em 72 h).
- Se o responsável perder uma permissão, as ferramentas que dependiam dela
  somem do agente na próxima execução, sem aviso no editor — revisitar se
  isso confundir os admins (ex.: alerta no editor).
- Revisitar quando surgir pedido de aprovação em lote, de eventos novos ou
  de agentes encadeados (hoje bloqueados de propósito).
