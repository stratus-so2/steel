# 0023 — Steel AI: modo Teste simula as escritas no servidor

- **Status:** Aceita
- **Data:** 2026-10-08
- **Decisores:** product owner (pedido "Steel AI modo teste > mostra o que faria sem modificar realmente", 2026-10-08) + time de engenharia

Complementa as ADRs [0018](./0018-steel-ai-agent-mode-server-confirmation.md)
(Build com confirmação), [0020](./0020-steel-agents-owner-identity-and-approvals.md)
(Steel Agents), [0021](./0021-steel-ai-autopilot-mode.md) (Autopilot) e
[0022](./0022-steel-ai-memory-saved-without-confirmation.md) (memória).

## Contexto

Antes de deixar a IA mexer nos dados — no Build, no Autopilot ou num agente
automático —, quem usa quer ver o plano inteiro com dados reais: quais
registros ela leria, o que criaria, alteraria, excluiria ou mandaria ao
cliente. O Build mostra uma escrita por vez e para o turno a cada proposta;
o Autopilot executa. Faltava um jeito de "ensaiar".

A forma fácil seria pedir ao modelo, no prompt, que "não execute nada". Isso
repete o erro que a ADR 0018 corrigiu: a garantia dependeria do modelo
obedecer, e um prompt injetado num dado lido bastaria para gravar algo.

## Decisão

**Novo modo `TEST` ("Teste"): as leituras rodam de verdade e toda escrita é
simulada pelo servidor, no caminho de execução de ferramentas — o `execute`
da ferramenta nunca é chamado.** O mesmo mecanismo serve o botão "Testar
agente" dos Steel Agents.

Detalhes para aplicar:

- **Onde a simulação acontece:** `simulateWriteTool` em
  `src/lib/ai/tools/registry.ts` faz `parse` → `preview` e para. Não cria
  `AiPendingAction`, não envia mensagem, não grava memória. O modelo recebe um
  resultado `status: simulated` com a prévia (a mesma do cartão de
  confirmação) e a nota de que nada foi alterado, para seguir o plano. O
  runtime do chat (`steel-ai-chat.service.ts`) e o runner dos agentes
  (`steel-agent-runner.ts`) desviam toda escrita para ela antes de qualquer
  outro ramo — o prompt do modo só explica, não protege.
- **Abrangência:** `CREATE`, `UPDATE`, `DELETE`, `ACTION` (inclusive
  mensagens a clientes) e as ferramentas de memória (`memory_save`,
  `memory_forget`, que ganharam `preview`).
- **Disponibilidade:** sempre que a IA está ligada (`aiEnabled`); não depende
  do modo agente nem de interruptor de admin, porque nada é escrito. O filtro
  de módulo e de permissão (RBAC) continua valendo — o teste só mostra o que
  aquela pessoa poderia fazer.
- **Rastro:** cada simulação vai para `AiActionLog` com
  `outcome = simulated` (não conta como ação executada). O uso de tokens é
  real e é registrado e cobrado normalmente.
- **Turno:** não para depois de uma escrita (como no Autopilot), para o
  modelo montar o plano inteiro. Na tela, cada escrita vira um cartão
  tracejado "Simulado — faria: …" e o fim do turno mostra "Em modo teste: N
  ações simuladas, nada foi alterado" com **Executar de verdade em Build**,
  que troca a conversa para Build e reenvia o último pedido — as escritas
  passam pela confirmação normal; a simulação nunca é "promovida" a
  execução.
- **Steel Agents ("Testar agente", `POST .../agents/{id}/test`):** execução
  com `isTest = true`; ferramentas `AUTO` e `APPROVAL` são simuladas (passo
  `SIMULATED` com a prévia), sem aprovação na inbox, sem aviso de falha. Não
  conta no limite mensal, não mexe em `lastRunAt`/`nextRunAt` e não aparece
  como última execução. Funciona com o agente pausado e com o modo agente
  desligado. Mesmo gate do "Executar agora" (responsável ou admin).

## Consequências

- O usuário vê o plano completo com dados reais, sem risco: um prompt
  injetado no modo Teste consegue no máximo gerar um cartão simulado.
- Uma escrita simulada não cria registro, então um passo que dependa do id
  criado (criar e depois atribuir) não tem o que consultar; o prompt pede ao
  modelo que descreva esse passo em texto, e a prévia pode falhar — o que
  aparece como erro da ferramenta, não como execução.
- A prévia é a fonte da verdade do que "faria": ferramenta com prévia pobre
  gera simulação pobre. Novas ferramentas de escrita já são obrigadas a ter
  `preview` (validação do registro).
- Custo aceito: tokens gastos num ensaio contam na cota. Revisitar se
  surgir pedido de "executar exatamente o que foi simulado" (hoje o Build
  pede de novo ao modelo).
