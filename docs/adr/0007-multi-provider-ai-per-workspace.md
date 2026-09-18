# 0007 — IA multi-provedor (OpenAI + Anthropic) habilitada por workspace

- **Status:** Aceita (implementada em 2026-09-18 — ver [Implementação](#implementação))
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

## Implementação

Registro de como a decisão foi implementada (2026-09-18). Não altera a
decisão acima.

- **Camada de provedor:** `src/lib/ai/` — interface única de chat (system
  prompt, histórico com imagens, tools, busca web nativa, saída JSON, contagem
  de tokens) com um adaptador OpenAI (Responses API) e um Anthropic (Messages
  API). Chaves são da plataforma (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`);
  provedor sem chave aparece como indisponível. Catálogo de modelos em
  `src/lib/ai/models.ts` (chave `"<provedor>:<modelo>"`); padrão
  `openai:gpt-4o-mini` para todas as funcionalidades.
- **Escopo:** vale para as três funcionalidades de IA — assistente do CRM,
  resposta automática e análise de sentimento do WhatsApp.
- **Ajustes (Ajustes do Workspace > Steel IA):** OWNER/ADMIN habilitam
  modelos, escolhem o modelo padrão de cada funcionalidade e a cota
  (`WorkspaceAiSettings`). Cada usuário escolhe o próprio modelo para o
  assistente do CRM (`UserAiPreference`); jobs em background usam sempre o
  padrão do workspace. O backend recusa modelo não habilitado
  (`AI_MODEL_NOT_ENABLED`) ou de provedor sem chave (`AI_PROVIDER_UNAVAILABLE`).
- **Recusas do Claude:** sem fallback automático para outro modelo; a recusa
  volta como resposta (previsível e auditável).
- **Cota de uso:** todo consumo vai para o livro-razão `AiUsage`
  (tokens + custo congelado).
  - Regra de custo: **1.000 tokens = US$ 4,00** (entrada + saída, qualquer
    provedor/modelo) — `usd_per_1k_tokens`, definida pela plataforma e não
    editável pelo admin do workspace.
  - Cota padrão: **US$ 50/mês por workspace** (≈ 12.500 tokens), editável
    pelo admin. Ciclo = mês calendário em UTC.
  - A cota é checada **antes** de cada chamada; ao ser atingida, novas
    chamadas são bloqueadas com `AI_QUOTA_EXCEEDED` (HTTP **402** — orçamento
    esgotado, não limite de taxa; sem `Retry-After`). Os jobs em background
    registram `skipped` (`ai_quota_exceeded`) e não respondem/classificam.
  - A chamada em curso pode ultrapassar um pouco a cota (o custo só é
    conhecido após a resposta).
- **Legado:** a chave OpenAI por workspace do WhatsApp (`encrypted_openai_api_key`)
  virou opcional e não é mais lida; a coluna pode ser removida numa migração
  futura. A transcrição de áudio continua no Whisper (OpenAI), pois o Claude
  não recebe áudio.
