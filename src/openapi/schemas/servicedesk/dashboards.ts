import { z } from 'zod'
import { dto } from '../../common'

/** DTOs dos dashboards e do CSAT do ServiceDesk (`types/sd-dashboard.d.ts`). */

const dateTime = () => z.iso.datetime()

export const SdDashboardDTO = dto(
  'SdDashboard',
  z.object({
    id: z.string(),
    title: z.string().meta({ example: 'KPIs (TV)' }),
    workspaceId: z.string(),
    module: z.literal('SERVICE_DESK'),
    createdById: z.string(),
    updatedById: z.string().nullable(),
    position: z.number().int(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdDashboardWidgetDTO = dto(
  'SdDashboardWidget',
  z.object({
    id: z.string(),
    dashboardId: z.string(),
    type: z.enum(['CHART', 'VIEW', 'IFRAME', 'RICH_TEXT']),
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int().meta({ description: 'Largura em colunas (1–12).' }),
    h: z.number().int(),
    config: z.record(z.string(), z.unknown()).meta({
      description:
        'Configuração do widget (mesmo formato da criação). Chart: `source` (`sd-tickets`, `sd-ticket-costs`, `sd-ticket-events`, `sd-kb-articles`), `filters`, `xField`, `yField`, `groupBy`, `aggregation` (`count|sum|avg|min|max`), `dateBucket` (`day|week|month`), `period` + `periodField`, `compareRange`, `limit`, `title`, `color`, `decimals`…',
    }),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdDashboardRowDTO = dto(
  'SdDashboardRow',
  z.record(z.string(), z.unknown()).meta({
    description:
      'Linha achatada da fonte, com rótulos em pt-BR e campos derivados. `sd-tickets`: código, tipo, fase, prioridade, severidade, departamento, responsável, cliente, catálogo, classificações, canal, `isOpen`, `isUnassigned`, `isCritical`, estados de SLA, `slaAtRisk`, `slaBreached`, `slaResolutionMetPct`/`slaFirstResponseMetPct` (0/100 — a média é a % de cumprimento), `firstResponseMinutes`, `resolutionMinutes`/`resolutionHours` (MTTR), `ageHours`, `reopenedPct`, `csatScore`, datas e campos customizados `cf_<chave>`. `sd-ticket-costs`: custo com `total` e contexto do chamado. `sd-ticket-events`: `flow`/`throughput` (Criados, Resolvidos…). `sd-kb-articles`: visualizações, votos e `helpfulPct`.',
    example: {
      id: 'ckt1',
      code: 'INC-000123',
      type: 'Incidente',
      priority: 'P1 - Crítica',
      isOpen: true,
      slaAtRisk: true,
      resolutionDueIn: 'em 25 min',
    },
  }),
)

export const SdTicketCsatDTO = dto(
  'SdTicketCsat',
  z.object({
    ticketId: z.string(),
    number: z.number().int(),
    csatScore: z.number().int().min(1).max(5),
    csatComment: z.string().nullable(),
  }),
)
