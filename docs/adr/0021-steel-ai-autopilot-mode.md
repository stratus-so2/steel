# 0021 — Steel AI: modo Autopilot executa escritas sem confirmação

- **Status:** Aceita
- **Data:** 2026-10-07
- **Decisores:** product owner (decisão "executa tudo sozinho", 2026-10-07) + time de engenharia

Complementa a [ADR 0018](./0018-steel-ai-agent-mode-server-confirmation.md):
os modos Explorar e Agente continuam iguais (agora chamados **Ask** e
**Build** na tela); esta ADR acrescenta um terceiro modo.

## Contexto

No modo agente (ADR 0018) toda escrita vira uma `AiPendingAction` e só
executa no clique de Confirmar. Para quem usa o Steel AI o dia todo isso
vira um clique por alteração e um turno que sempre termina "aguardando
confirmação" — o modelo não encadeia passos (criar o chamado, atribuir,
avisar o cliente). O product owner pediu um modo em que a IA execute
tudo sozinha, **inclusive exclusões e mensagens a clientes**, desde que o
workspace opte por isso e tudo fique registrado.

## Decisão

**Novo modo `AUTOPILOT`: a ferramenta de escrita chamada pelo modelo
executa na hora, sem confirmação, e fica registrada como qualquer escrita
confirmada.** Só existe quando o admin liga
`WorkspaceAiSettings.autopilotEnabled` (padrão desligado), e exige também o
modo agente (`agentModeEnabled`).

Detalhes para aplicar:

- **Filtro antes do modelo** (`isToolAllowed`): escrita só aparece em
  `AGENT` ou `AUTOPILOT`, com `agentModeEnabled`; em `AUTOPILOT` também
  com `autopilotEnabled`. Pedir `AUTOPILOT` com o interruptor desligado
  responde `AI_AUTOPILOT_DISABLED` (criar conversa, trocar o modo ou
  enviar mensagem); a tela cai para Build.
- **Execução** (`executeAutopilotWrite`): `parse` → `preview` (o título e
  os campos viram o cartão de resultado) → `AiPendingAction` **criada já
  reivindicada** (`status = EXECUTED`, `decidedById` = usuário,
  `autoExecuted = true`, nunca fica `PENDING` nem expira) → `runTool` com as
  permissões do usuário → resultado na linha (`EXECUTED` ou `FAILED`),
  `AiActionLog` (`source = ASSISTANT`, `actorId` = usuário) e
  `auditMutation` com a ação `auto_execute`. Mesmo caminho do
  `executeClaimedAction`, sem a nota de decisão (o resultado já vai como
  mensagem `TOOL` do turno).
- **Sem confirmação dupla**: exclusões rodam direto, por decisão do
  product owner. O service de domínio continua sendo a autoridade (RBAC,
  módulo, workspace) e o opt-out de mensagens a clientes continua valendo.
- **O turno não para** depois de uma escrita (diferente do Build): o
  modelo recebe o resultado e pode encadear o próximo passo, dentro do
  limite de 8 rodadas.
- **Prompt**: no Autopilot o modelo é avisado de que cada escrita executa
  na hora e que deve conferir o registro antes de excluir ou mandar
  mensagem; conteúdo de anexo é dado, não instrução.
- **Tela**: segmento "Autopilot" desabilitado com explicação quando o
  workspace não liberou; quando ativo, um aviso discreto acima do
  compositor; as escritas aparecem como cartões compactos de resultado,
  sem botões.
- **Steel Agents** não mudam (ADR 0020): lá a autonomia continua por
  ferramenta e exclusão sempre pede aprovação.

## Consequências

- Quem liga o Autopilot ganha fluxos de vários passos sem cliques; o
  custo aceito é que um prompt injetado num dado lido pode executar uma
  escrita com as permissões do usuário — por isso o padrão é desligado,
  o interruptor é do admin e cada execução fica em `ai_action_logs` e na
  auditoria (`auto_execute`), com o vínculo à ação (`autoExecuted`).
- Desfazer é manual: não há "desfazer" automático de uma escrita do
  Autopilot.
- Revisitar se surgir pedido de Autopilot por usuário (hoje é por
  workspace), de lista de ferramentas excluídas do Autopilot, ou de
  confirmação só para exclusões.
