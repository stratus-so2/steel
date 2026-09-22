import z from 'zod'
import { booleanQuery, sdDescription, sdName } from './sd-config.schema'

/**
 * Custo unitário: número ou string decimal (vírgula ou ponto), 0 a
 * 999.999.999.999,99 — normalizado para string com 2 casas (`"129.90"`).
 */
export const SdMoneySchema = z
  .union([z.number(), z.string().trim()])
  .transform((value, ctx) => {
    const n =
      typeof value === 'number' ? value : Number(value.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0 || n > 999_999_999_999.99) {
      ctx.addIssue({ code: 'custom', message: 'Valor inválido' })
      return z.NEVER
    }
    return (Math.round(n * 100) / 100).toFixed(2)
  })

const sku = z.string().trim().max(64).nullable().optional()
const stock = z.number().int().min(0).max(1_000_000_000).nullable().optional()

export const CreateSdPartSchema = z.object({
  name: sdName,
  sku,
  description: sdDescription,
  unitCost: SdMoneySchema.default('0.00'),
  /** Estoque (vazio = não controlado). */
  stock,
  active: z.boolean().default(true),
})
export type CreateSdPartDTO = z.infer<typeof CreateSdPartSchema>

export const UpdateSdPartSchema = z
  .object({
    name: sdName.optional(),
    sku,
    description: sdDescription,
    unitCost: SdMoneySchema.optional(),
    stock,
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdPartDTO = z.infer<typeof UpdateSdPartSchema>

export const ListSdPartsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  includeInactive: booleanQuery,
})
export type ListSdPartsDTO = z.infer<typeof ListSdPartsSchema>
