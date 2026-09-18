# Feature flags por workspace (entitlements)

Módulos (`CRM`, `COMMUNICATION`, `SERVICE_DESK`) continuam sendo liberados
inteiros por workspace. **Feature flags** são capacidades opcionais _dentro_
de um módulo, com default por plano e override por cliente — para entregar
customização exclusiva sem código separado.

## Peças

| Peça | Onde |
| ---- | ---- |
| Catálogo (chave, módulo, rótulo, descrição, default por plano) | `src/config/features.ts` |
| Overrides por workspace (on/off, nota, validade) | tabela `workspace_feature_overrides` |
| Resolução (override ativo > default do plano) | `src/lib/feature-flags.ts` |
| Cache (plano + overrides, TTL 5 min) | `src/cache/workspace-features.cache.ts` |
| Gate no service | `assertFeature(workspaceId, key)` / `FeatureFlagService.hasFeature` (`src/services/feature-flag.service.ts`) |
| API admin | `GET/PATCH /api/admin/workspaces/[id]/features` |
| API do workspace (mapa efetivo) | `GET /api/workspaces/[id]/features` |
| UI | `useFeature` / `<FeatureGate>` (`src/hooks/use-feature-flags.ts`, `app/_components/feature-gate.tsx`); card "Funcionalidades" em `/admin/workspaces/[id]` |

O cache é invalidado ao gravar um override e quando o plano muda (webhook de
assinatura, reversão de trial). Um override com validade expirada deixa de
valer sozinho (a resolução roda a cada leitura) e aparece como "expirado" no
painel. Overrides de chaves que saíram do catálogo são ignorados.

## Features atuais

| Chave | Módulo | Gate no service | UI escondida |
| ----- | ------ | --------------- | ------------ |
| `crm.aiAssistant` | CRM | criar conversa, enviar mensagem, anexar arquivo | widget de IA no layout do workspace |
| `crm.socialPublishing` | CRM | criar, reagendar e publicar post agendado | página "Redes sociais" do CRM |
| `communication.broadcasts` | WhatsApp | criar, disparar e importar CSV de transmissão | página "Transmissões" |

Todas estão **ligadas em todos os planos** para não mudar nada para quem já
usa; restringir por plano é decisão de produto (basta mudar `planDefaults`).
Leituras (histórico de conversas, posts, transmissões) continuam abertas com a
feature desligada — desligar nunca esconde dado existente.

## Adicionar uma feature

1. Nova entrada em `FEATURE_CATALOG` (`<módulo>.<capacidade>`, os 4 planos em
   `planDefaults`). A chave nunca muda depois de publicada.
2. No service, logo depois de `assertMember`/`assertModuleMember`:
   `const feature = await assertFeature(workspaceId, 'x.y'); if (!feature.ok) return feature`.
3. Na UI, `<FeatureGate workspaceId feature='x.y'>` (ou `useFeature`) para
   esconder o que não vale — é só apresentação, o bloqueio real é o service.
4. Teste de service cobrindo `FEATURE_NOT_ENABLED` (mock de
   `@/src/services/feature-flag.service`).

## Limitações conhecidas

- Jobs do worker que publicam algo já agendado (posts sociais vencidos,
  transmissões agendadas) não checam a feature: desligar impede criar/disparar
  novos, mas não cancela o que já estava na fila.
- `src/config/plans.ts` (catálogo herdado do Nexo) continua sem uso; as
  features do Steel vivem só em `src/config/features.ts`.
