import { z } from 'zod'
import { ForecastSchema } from '@/src/schemas/crm-forecast.schema'
import { dto } from '../../common'

/** DTOs de forecast e cotas (`src/schemas/crm-forecast.schema.ts`, `types/crm-quota.d.ts`). */

export const CrmForecastDTO = dto('CrmForecast', ForecastSchema)

export const CrmQuotaDTO = dto(
  'CrmQuota',
  z.object({
    id: z.string().meta({ example: 'ckw1quot0000ab7d3k1e5xyz' }),
    workspaceId: z.string(),
    ownerId: z.string().meta({ description: 'Vendedor dono da meta.' }),
    period: z.enum(['MONTH', 'QUARTER']),
    periodKey: z.string().meta({
      description: 'Período: `AAAA-MM` (mês) ou `AAAA-Qn` (trimestre).',
      example: '2026-09',
    }),
    targetAmount: z.number().meta({ example: 150000 }),
    createdById: z.string(),
    updatedById: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),
)
