# 0007 — IA multi-provedor (OpenAI + Anthropic) habilitada por workspace

- **Status:** Aceita (implementação pendente)
- **Data:** 2026-09-18
- **Decisores:** dono do produto

## Contexto

Hoje a IA do CRM (`src/services/crm-ai.service.ts`) usa só a OpenAI
(`OPENAI_API_KEY`/`OPENAI_MODEL`); o schema de env já prevê
`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, mas nada as usa. Clientes diferentes
têm exigências diferentes (custo, qualidade por tarefa, onde o dado é
processado), e depender de um único provedor é um ponto único de falha.

## Decisão

- O Steel suporta **dois provedores de IA: OpenAI e Anthropic**.
- Cada **workspace habilita, nas configurações**, quais provedores podem ser
  usados (um, outro ou ambos). OWNER/ADMIN decidem.
- Na hora de usar a IA, o **usuário escolhe entre os provedores habilitados**
  no seu workspace. Provedor não habilitado não aparece e é recusado pelo
  backend.

## Consequências

- Precisa de: configuração por workspace persistida (Prisma), checagem no
  service (autorização mora no service), seletor na UI e uma camada de
  provedor comum (mesma interface de chat/tools para OpenAI e Anthropic).
- Custos de API passam a variar por workspace/provedor — os créditos de IA do
  plano (`aiCreditsPerSeat`, hoje não aplicados — ver
  [revisão de planos](../plans-review.md)) devem ser contados independentemente
  do provedor.
- Os termos/DPA devem listar os dois provedores como suboperadores.
- A regra de "sem dados pessoais" do [0006](./0006-central-ai-assistant-claude-code.md)
  vale para o assistente interno, não para a IA do produto, que processa os
  dados do próprio cliente por solicitação dele.
