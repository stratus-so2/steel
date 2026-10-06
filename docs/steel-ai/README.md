# Steel AI — contrato

Assistente de IA transversal (ServiceDesk, CRM, Comunicação e plataforma) com dois modos, e base dos Steel Agents.

- **Explorar** (`EXPLORE`): só ferramentas de leitura (`kind = READ`). É o comportamento do antigo assistente do CRM, agora para todos os módulos.
- **Agente** (`AGENT`): também ferramentas de escrita (`CREATE`, `UPDATE`, `DELETE`, `ACTION`). **Toda escrita vira uma `AiPendingAction`** com prévia e só executa quando o usuário clica em **Confirmar** — o modelo nunca confirma sozinho. `DELETE` exige confirmação dupla (`doubleConfirmed: true`). Ação pendente expira em 30 min. O admin desliga o modo agente do workspace inteiro em Ajustes > Steel IA (`WorkspaceAiSettings.agentModeEnabled`).

Decisões do product owner (06/10/2026): toda escrita confirma; nos Steel Agents cada ferramenta é "automática" ou "requer aprovação" (padrão: requer; exclusão sempre requer, pela inbox); o widget flutuante de IA do CRM sai — fica só a tela Steel AI.

## Regras de segurança

1. Ferramenta roda com as permissões do usuário (`ctx.actorId`) e chama o **service de domínio** — o service continua sendo a autoridade (RBAC, módulo, workspace). `module`/`permission` na ferramenta só filtram o que o modelo enxerga.
2. Filtro antes do modelo: modo (EXPLORE ⇒ só READ), módulo habilitado no workspace, permissão do perfil e `agentModeEnabled`.
3. Escrita: `parse` → `preview` (não altera nada) → `AiPendingAction(PENDING)` → evento `action.pending` → humano confirma → `execute` → `AiActionLog` + `auditMutation` → mensagem `TOOL` com o resultado no histórico, para o modelo saber na próxima rodada.
4. Na confirmação o servidor revalida tudo (dono da ação, status, validade, modo agente ligado, permissão) e roda `parse` de novo sobre `args`.
5. Saída para o modelo limitada (~20 KB); listagens paginam (padrão 20, máx. 50).
6. Mensagem a cliente (WhatsApp, e-mail) é `ACTION` e respeita opt-out (`docs/lgpd.md`).

## API

Todas em `app/api/workspaces/[id]/ai/**`, com o fluxo padrão de rota (withAxiom → sessão → rate limit → Zod → service → envelope). Conversa é privada do usuário.

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/ai/capabilities` | — | `{ agentModeEnabled, modules: AiModuleDTO[], modelKey, quota: { usedUsd, quotaUsd } }` |
| GET | `/ai/conversations?q=` | — | `AiConversationDTO[]` (fixadas primeiro, depois `updatedAt` desc) |
| POST | `/ai/conversations` | `CreateAiConversationSchema` | 201 `AiConversationDTO` |
| GET / PATCH / DELETE | `/ai/conversations/[conversationId]` | `UpdateAiConversationSchema` | `AiConversationDTO` (DELETE = soft delete) |
| GET | `/ai/conversations/[conversationId]/messages` | — | `AiMessageDTO[]` |
| POST | `/ai/conversations/[conversationId]/messages` | `SendAiMessageSchema` | `text/event-stream` de `SteelAiStreamEvent`; erro antes do stream começar volta como JSON 4xx |
| GET | `/ai/actions?status=&conversationId=` | — | `AiPendingActionDTO[]` (do usuário) |
| POST | `/ai/actions/[actionId]/confirm` | `ConfirmAiPendingActionSchema` | `AiPendingActionDTO` (`EXECUTED` ou `FAILED`) |
| POST | `/ai/actions/[actionId]/cancel` | — | `AiPendingActionDTO` |

Tipos: `types/steel-ai.d.ts`. Schemas: `src/schemas/steel-ai.schema.ts`. Contrato de ferramenta: `src/lib/ai/tools/types.ts`. Uso de IA vai no razão `AiUsage` com `feature = STEEL_ASSISTANT` (agentes: `STEEL_AGENT`), modelo pela configuração `crmAssistantModel` (rótulo "Steel AI") ou preferência do usuário.

## Fatias (onda 2) — quem é dono de quê

| Fatia | Dono de |
|---|---|
| **ai-core** | `src/lib/ai/{types,anthropic-provider,openai-provider}.ts` (streaming), `src/lib/ai/tools/registry.ts` + `platform.ts`, `src/lib/ai/steel-ai-prompt.ts`, repositories/mappers/services `ai-conversation`, `ai-pending-action`, `ai-action-log`, `steel-ai-chat`, rotas `app/api/workspaces/[id]/ai/**`, OpenAPI dessas rotas, ajustes de IA (rótulo, preferência do usuário, interruptor do modo agente) |
| **ai-tools-crm** | `src/lib/ai/tools/crm.ts` (+ `crm/*`), remoção do widget e do assistente antigo do CRM (`crm-ai*.ts`, rotas `crm/ai/**`, `use-crm-ai.ts`, `types/crm-ai.d.ts`, montagem no layout) — tabelas `crm_ai_*` ficam |
| **ai-tools-sd** | `src/lib/ai/tools/servicedesk.ts` (+ `servicedesk/*`) |
| **ai-tools-zap** | `src/lib/ai/tools/whatsapp.ts` (+ `whatsapp/*`) |
| **ai-ui** | `app/(private)/[workspace-slug]/ai/**`, `app/_components/steel-ai/**`, `src/hooks/use-steel-ai.ts` (inclui o leitor do SSE), botão "Steel AI" na barra global, blocos reui |
