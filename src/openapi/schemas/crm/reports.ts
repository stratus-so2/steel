import { z } from 'zod'
import {
  CRM_REPORT_FILTER_OPERATORS,
  CRM_REPORT_SOURCES,
  CrmReportDataSchema,
  CrmReportQuerySchema,
} from '@/src/schemas/crm-report.schema'
import { dto } from '../../common'

/** DTOs de relatórios e dashboards do CRM (`types/crm-report.d.ts`, `types/crm-dashboard.d.ts`). */

const dateTime = () => z.iso.datetime()
const MODULES = ['SERVICE_DESK', 'CRM', 'COMMUNICATION'] as const

export const CrmReportDTO = dto(
  'CrmReport',
  z.object({
    id: z.string().meta({ example: 'ckw1rprt0000ab7d3k1e5xyz' }),
    workspaceId: z.string(),
    module: z.enum(MODULES).meta({
      description: 'Módulo dono do relatório (as rotas do CRM criam `CRM`).',
    }),
    name: z.string().meta({ example: 'Oportunidades por etapa' }),
    source: z.enum(CRM_REPORT_SOURCES).meta({
      description: 'Fonte legada (fonte do primeiro dataset).',
    }),
    columns: z.array(z.string()),
    filters: z.array(
      z.object({
        field: z.string(),
        operator: z.enum(CRM_REPORT_FILTER_OPERATORS),
        value: z.string(),
      }),
    ),
    groupBy: z.string().nullable(),
    sort: z
      .object({ field: z.string(), direction: z.enum(['asc', 'desc']) })
      .nullable(),
    query: CrmReportQuerySchema.meta({
      description:
        'Query normalizada (join/union). Sempre presente — sintetizada a partir dos campos legados quando não foi salva.',
    }),
    position: z.number(),
    createdById: z.string(),
    updatedById: z.string().nullable(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const CrmReportDataDTO = dto(
  'CrmReportData',
  CrmReportDataSchema.meta({
    description:
      'Resultado processado: `columns` (chave + rótulo) e `rows` indexadas por `column.key`; `total` = número de linhas.',
  }),
)

export const CrmDashboardDTO = dto(
  'CrmDashboard',
  z.object({
    id: z.string().meta({ example: 'ckw1dash0000ab7d3k1e5xyz' }),
    title: z.string().meta({ example: 'Vendas do trimestre' }),
    workspaceId: z.string(),
    module: z.enum(MODULES),
    createdById: z.string(),
    updatedById: z.string().nullable(),
    position: z.number(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const CrmDashboardWidgetDTO = dto(
  'CrmDashboardWidget',
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
        'Configuração do tipo (`CHART`: gráfico; `VIEW`: tabela de uma fonte; `IFRAME`: `url`; `RICH_TEXT`: `html`) — mesmo formato do corpo de criação.',
    }),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)
