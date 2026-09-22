import z from 'zod'
import { SdTicketTypeEnum } from '@/src/schemas/sd-rule.schema'

export const SD_VIEW_MODES = ['KANBAN', 'LIST', 'TABLE'] as const

/** Filtros no mesmo formato da query de `GET .../tickets` (chave → valor). */
const filters = z
  .record(
    z.string().max(64),
    z.union([
      z.string().max(500),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string().max(200)).max(100),
    ]),
  )
  .refine((f) => Object.keys(f).length <= 50, 'Filtros demais')

const sort = z
  .array(
    z.object({
      field: z.string().min(1).max(64),
      order: z.enum(['asc', 'desc']),
    }),
  )
  .max(5)

const columns = z.array(z.string().min(1).max(64)).max(60)

export const CreateSdSavedViewSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(80),
  ticketType: SdTicketTypeEnum.nullable().optional(),
  mode: z.enum(SD_VIEW_MODES).default('KANBAN'),
  filters: filters.default({}),
  sort: sort.default([]),
  columns: columns.default([]),
  shared: z.boolean().default(false),
  position: z.number().int().min(0).max(10_000).optional(),
})

export type CreateSdSavedViewDTO = z.infer<typeof CreateSdSavedViewSchema>

export const UpdateSdSavedViewSchema = z
  .object({
    name: z.string().trim().min(1, 'Nome é obrigatório').max(80).optional(),
    ticketType: SdTicketTypeEnum.nullable().optional(),
    mode: z.enum(SD_VIEW_MODES).optional(),
    filters: filters.optional(),
    sort: sort.optional(),
    columns: columns.optional(),
    shared: z.boolean().optional(),
    position: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Informe ao menos um campo',
  })

export type UpdateSdSavedViewDTO = z.infer<typeof UpdateSdSavedViewSchema>
