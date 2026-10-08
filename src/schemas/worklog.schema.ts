import { z } from 'zod'
import {
  dayKeySpan,
  MAX_WORKLOG_RANGE_DAYS,
  WORKLOG_PERIOD_PRESETS,
} from '@/src/lib/productivity/period'

/**
 * Ajustes › Registros de trabalho: the ServiceDesk time entries of the
 * workspace (list + CSV) and the productivity indicators (panel + CSV).
 * Days are civil days in the workspace's business-calendar time zone.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/

const LocalDay = z
  .string()
  .refine((value) => DAY.test(value) && !Number.isNaN(Date.parse(value)), {
    message: 'Use uma data válida no formato AAAA-MM-DD',
  })
  .meta({
    description: 'Dia no fuso do expediente do workspace (`AAAA-MM-DD`).',
    example: '2026-10-01',
  })

const periodFields = {
  period: z
    .enum(WORKLOG_PERIOD_PRESETS)
    .default('last_30_days')
    .meta({
      description: `Período. \`custom\` exige \`from\` e \`to\` (inclusivos, até ${MAX_WORKLOG_RANGE_DAYS} dias).`,
    }),
  from: LocalDay.optional(),
  to: LocalDay.optional(),
}

type PeriodInput = {
  period: (typeof WORKLOG_PERIOD_PRESETS)[number]
  from?: string
  to?: string
}

function checkCustomRange(value: PeriodInput, ctx: z.RefinementCtx): void {
  if (value.period !== 'custom') return
  if (!value.from || !value.to) {
    ctx.addIssue({
      code: 'custom',
      path: [value.from ? 'to' : 'from'],
      message: 'Informe o início e o fim do período personalizado',
    })
    return
  }
  if (value.from > value.to) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: 'O fim do período precisa ser depois do início',
    })
    return
  }
  if (dayKeySpan(value.from, value.to) > MAX_WORKLOG_RANGE_DAYS) {
    ctx.addIssue({
      code: 'custom',
      path: ['to'],
      message: `O período pode ter no máximo ${MAX_WORKLOG_RANGE_DAYS} dias`,
    })
  }
}

const userId = z.string().trim().min(1).max(64).optional().meta({
  description:
    'Filtra uma pessoa. Quem não é OWNER/ADMIN só pode informar o próprio id.',
})

const filterFields = {
  ...periodFields,
  userId,
  ticket: z.string().trim().min(1).max(32).optional().meta({
    description: 'Código ou número do chamado (`INC-000123`, `#123`, `123`).',
  }),
  billable: z.enum(['true', 'false']).optional().meta({
    description: 'Só faturáveis (`true`) ou só não faturáveis (`false`).',
  }),
  source: z.enum(['TIMER', 'MANUAL']).optional().meta({
    description: 'Origem: cronômetro ou lançamento manual.',
  }),
}

export const WorklogListQuerySchema = z
  .object({
    ...filterFields,
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .superRefine(checkCustomRange)

export const WorklogExportQuerySchema = z
  .object(filterFields)
  .superRefine(checkCustomRange)

export const ProductivityQuerySchema = z
  .object({ ...periodFields, userId })
  .superRefine(checkCustomRange)

export type WorklogListQuery = z.infer<typeof WorklogListQuerySchema>
export type WorklogExportQuery = z.infer<typeof WorklogExportQuerySchema>
export type WorklogFilter = WorklogExportQuery
export type ProductivityQuery = z.infer<typeof ProductivityQuerySchema>
