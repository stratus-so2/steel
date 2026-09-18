# Revisão dos limites dos planos — preparação para decisão

> Documento de apoio. **Nenhum valor foi alterado**: os números abaixo são os
> que estão em `src/config/plans.ts` hoje. A tabela sugerida no final é uma
> proposta para o dono do produto decidir.

## Resumo

- O catálogo de planos (`src/config/plans.ts`) veio **inteiro da base Nexo**
  (gestão de projetos, inspirado no Plane): limites de páginas/wiki, ciclos,
  work items, importadores (Jira, Linear, Asana...). **Nenhum limite fala de
  CRM ou WhatsApp**, que são o produto do Steel.
- De tudo o que está no catálogo, **só `seats` é aplicado no backend**. O
  resto (créditos de IA, convidados, versões de páginas, ~85 features e 14
  capabilities) só aparece na tabela da página de preços.
- **BUSINESS (12 assentos) é mais limitado que PRO (ilimitado)** e igual ao
  FREE (12). Como o trial é BUSINESS, um workspace em trial tem menos
  assentos do que teria no PRO.
- Assentos comprados na assinatura (`subscription.seats`, até 10.000) **não
  são considerados** no limite de convites: um BUSINESS que paga 30 assentos
  continua travado em 12.

## Limites numéricos (`LIMITS`)

| Limite | FREE | PRO | BUSINESS | ENTERPRISE | Onde é aplicado |
| ------ | ---- | --- | -------- | ---------- | --------------- |
| `seats` (membros + convites pendentes) | 12 | ilimitado | **12** | ilimitado | `InvitationService.assertSeatAvailable` (`src/services/invitation.service.ts`) ao criar convite (workspace e projeto) e ao aceitar → `SEAT_LIMIT_REACHED` (403). Exibido em `settings/billing` (usa `subscription.seats` se houver, senão o limite do plano) |
| `aiCreditsPerSeat` | 500 | 1.000 | 2.000 | ilimitado | **Não aplicado.** A IA do CRM (`crm-ai.service.ts`) e a do WhatsApp (`whatsapp-ai-reply`) não contam créditos. Só na página de preços |
| `guestsPerSeat` | 0 | 5 | 5 | ilimitado | **Não aplicado.** Não existe papel "convidado" (papéis: OWNER, ADMIN, MEMBER, VIEWER) |
| `pageVersions` | 0 | 20 | 60 | ilimitado | **Não aplicado.** Não há versionamento de páginas no código |
| `pageVersionDays` | 0 | 30 | 90 | ilimitado | **Não aplicado** (idem) |

Outros valores relacionados, fora do catálogo:

| Item | Valor | Onde |
| ---- | ----- | ---- |
| Preço PRO | R$ 43,02/assento/mês · R$ 387,15/assento/ano | `src/config/plan-prices.ts` |
| Preço BUSINESS | R$ 80,06/assento/mês · R$ 836,81/assento/ano | idem |
| Trial | BUSINESS por 14 dias; banner a partir de 5 dias do fim; reversão de hora em hora | `src/config/trial.ts`, fila `trial-lifecycle` |
| Assentos na compra | 1 a 10.000 | `src/schemas/subscription.schema.ts` |
| Upload de mídia (genérico / anexo da IA / vídeo de landing page) | 5 MB / 10 MB / 25 MB | `src/services/media/_media.ts`, `crm-ai-attachment.ts`, `media/crm-landing-page-media.service.ts` — iguais para todos os planos |

## Features e capabilities (`FEATURE_MIN_TIER`, `CAPABILITIES`)

- **Features** (booleanas, monotônicas por tier): `projects`, `workItems`,
  `cycles`, `pages`, `importJira`... (FREE); `wiki`, `sla`, `github`,
  `slack`... (PRO); `saml`, `oidc`, `recurringWorkItems`, `intakeForms`...
  (BUSINESS); `ldap`, `apiAuditLogs`... (ENTERPRISE).
- **Capabilities** (níveis): `estimates`, `views`, `bulkOps`, `dashboards`,
  `timeTracking`, `workflows`, `roles`, `guests`, `supportChannels`...
- **Onde são aplicadas:** em lugar nenhum do backend. `can()` /
  `capabilityOf()` de `src/lib/plans.ts` não são chamados fora dos testes; o
  único consumidor é `app/(web)/_components/pricing/table/pricing-table-data.ts`.
- Várias descrevem funcionalidades que **não existem no Steel** (ciclos, work
  items, importadores, integrações GitHub/GitLab/Sentry/draw.io, SAML/OIDC/LDAP).
  A página de preços promete o que o produto não entrega.

## Inconsistências encontradas

1. **BUSINESS < PRO em assentos** (12 vs ilimitado), e BUSINESS = FREE.
   Hierarquia invertida: quem paga mais tem menos.
2. **Trial em BUSINESS** herda o teto de 12 — o trial é mais restrito que o
   plano mais barato pago.
3. **Assentos comprados ignorados** na checagem de convites (usa só o limite
   do plano).
4. **Limites e features exibidos mas não aplicados** (créditos de IA,
   convidados, versões de páginas, todas as features/capabilities).
5. **Catálogo sem nada de CRM/WhatsApp**: nenhum limite de conexões WhatsApp,
   contatos, transmissões, campanhas de e-mail, contas sociais, armazenamento
   ou módulos habilitados por plano.
6. **Módulos (CRM, Comunicação, ServiceDesk)** são habilitados por workspace
   (`WorkspaceModuleAccessService`) independentemente do plano.
7. Typo herdado numa chave: `wikiCollecions`.

## Tabela sugerida para o Steel (para decisão)

Proposta de ponto de partida — **valores ilustrativos**, a calibrar com
custo real (WhatsApp/IA/armazenamento) e posicionamento comercial.

| Limite | FREE | PRO | BUSINESS | ENTERPRISE | Como aplicar |
| ------ | ---- | --- | -------- | ---------- | ------------ |
| Assentos | 3 | até 25 (pagos por assento) | ilimitado (pagos por assento) | ilimitado | `limitOf` + considerar `subscription.seats` |
| Módulos incluídos | CRM | CRM + Comunicação | CRM + Comunicação + ServiceDesk | todos | `WorkspaceModuleAccessService` consultar o plano |
| Conexões WhatsApp (números) | 1 | 2 | 5 | sob contrato | `WhatsappConnectionService.create` |
| Contatos no CRM (pessoas + empresas) | 1.000 | 25.000 | 250.000 | ilimitado | `CrmPersonService`/`CrmCompanyService.create` |
| Mensagens de transmissão / mês | 0 | 5.000 | 50.000 | sob contrato | `WhatsappBroadcastService` |
| E-mails de campanha / mês | 500 | 10.000 | 100.000 | sob contrato | `CrmEmailCampaignService` |
| Contas de redes sociais conectadas | 1 | 5 | 20 | ilimitado | `CrmSocialService` |
| Créditos de IA por assento / mês (OpenAI + Anthropic, ver ADR 0007) | 100 | 1.000 | 3.000 | sob contrato | contador por workspace nos services de IA |
| Resposta automática por IA no WhatsApp | — | ✓ | ✓ | ✓ | `whatsapp-ai-config.service.ts` |
| Armazenamento (mídia, anexos) | 1 GB | 20 GB | 200 GB | sob contrato | soma por workspace no upload |
| Backup por workspace sob demanda | — | — | ✓ | ✓ | `triggerWorkspaceBackup` |
| Conexão a banco externo por módulo | — | — | ✓ | ✓ | `WorkspaceConnectionService` |
| Trial | BUSINESS 14 dias | | | | `src/config/trial.ts` |

Decisões necessárias:

1. Qual o teto de assentos de cada plano (e se BUSINESS passa a ser ≥ PRO).
2. Se assentos comprados na assinatura substituem o teto do plano.
3. Quais limites de CRM/WhatsApp entram no catálogo (e com quais valores).
4. Se as features/capabilities herdadas do Nexo saem da página de preços (ou
   são substituídas por features do Steel).
5. Se o plano define os módulos habilitados.

Depois da decisão: atualizar `PlanLimitsSchema` (`src/schemas/plan.schema.ts`),
`src/config/plans.ts`, a tabela de preços e aplicar cada limite no service
correspondente, com código de erro próprio em `src/errors/codes.ts`
(`<FEATURE>_LIMIT_REACHED`).
