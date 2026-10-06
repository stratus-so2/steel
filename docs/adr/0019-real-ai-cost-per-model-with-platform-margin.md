# 0019 — Custo real de IA por modelo com margem da plataforma

- **Status:** Aceita
- **Data:** 2026-10-06
- **Decisores:** product owner (decisão "Reduzir tokens + custo real", 2026-10-06) e time de engenharia

Substitui **só a regra de custo** do [ADR 0007](./0007-multi-provider-ai-per-workspace.md)
(1.000 tokens = US$ 4,00). O resto do 0007 — multi-provedor, modelos por
workspace, cota mensal checada antes da chamada, custo congelado no
livro-razão — continua valendo.

## Contexto

O ADR 0007 fixou o custo em US$ 4,00 por 1.000 tokens (entrada + saída,
qualquer modelo). Com o Steel AI, cada chamada leva o system prompt, as
ferramentas e o histórico: o smoke real do integrador mediu 12k–23k tokens de
entrada por turno, ou seja, US$ 49–94 por pergunta contra a cota padrão de
US$ 50/mês. O workspace ficava bloqueado depois de uma ou duas perguntas. A
regra era milhares de vezes o preço do provedor (o `gpt-4o-mini` cobra
US$ 0,15 por **1 milhão** de tokens de entrada).

Ao mesmo tempo, as ~95 ferramentas iam em toda chamada (~14k tokens).

## Decisão

O custo de cada chamada é o **preço oficial do modelo** vezes a **margem da
plataforma**:

```
custo = ((entrada − entrada_cache) × preço_entrada
         + entrada_cache × preço_cache
         + saída × preço_saída) / 1.000.000 × margem
```

- Os preços (US$ por 1M tokens: entrada, saída e entrada em cache) ficam no
  `AI_MODEL_CATALOG` (`src/lib/ai/models.ts`), com a fonte e a data da
  consulta no comentário. Modelo fora do catálogo é cobrado pelo preço mais
  caro do catálogo (nunca abaixo do custo).
- Tokens em cache só entram quando o provedor informa (hoje a OpenAI, com
  cache automático); sem preço de cache, contam como entrada normal.
- A **margem** é da plataforma, definida pelo **admin global** em
  `/admin/ai` (tabela `platform_ai_settings`, linha única; padrão 1,0 =
  preço de custo; aceita de 0,1 a 100). Cada alteração é auditada
  (`auditMutation` + `admin_audit_logs`). Cada processo reaproveita a margem
  lida por até 1 minuto.
- `AiUsage.costUsd` continua **congelado no momento da chamada**: mudar preço
  ou margem não altera consumo já lançado.
- A coluna `workspace_ai_settings.usd_per_1k_tokens` fica (histórico), marcada
  como depreciada; não é mais lida. A cota mensal por workspace (padrão
  US$ 50) não muda.
- Junto com a mudança de preço, o Steel AI passou a mandar só as ferramentas
  que a rodada precisa (núcleo + ferramentas fixadas pelo histórico + as do
  módulo citado, dentro de ~3k tokens, e a meta-ferramenta
  `steel_find_tools` para pedir o resto) e o histórico ficou limitado a
  ~6k tokens. Um primeiro turno típico caiu de ~14,7k para 1,1k–3,6k tokens
  estimados.

## Consequências

- A cota volta a ter sentido: US$ 50 compram milhões de tokens no
  `gpt-4o-mini` e o admin do workspace vê o preço de cada modelo em
  Ajustes > Steel IA.
- O custo depende do modelo escolhido; modelos grandes (Opus, GPT-5) gastam a
  cota bem mais rápido, o que agora é visível e justo.
- A tabela de preços é manual: quando um provedor mudar preço, alguém precisa
  atualizar o catálogo (o histórico fica com o preço da época).
- A margem é global; uma margem por plano ou por workspace, se for preciso,
  vira um ADR novo.
- Consumo lançado antes desta mudança segue na regra antiga (pode ter
  bloqueado workspaces no mês corrente — o admin pode aumentar a cota).
