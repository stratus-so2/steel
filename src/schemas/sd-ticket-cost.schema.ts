import z from 'zod'
import { sdId } from './sd-config.schema'
import { SdMoneySchema } from './sd-part.schema'

export const SD_COST_CATEGORIES = [
  'LABOR',
  'TRAVEL',
  'MATERIAL',
  'SERVICE',
  'LICENSE',
  'OTHER',
] as const
export const SdCostCategoryEnum = z.enum(SD_COST_CATEGORIES)

/**
 * Quantidade decimal (horas, km, unidades…): número ou string com vírgula ou
 * ponto, maior que zero, até 9.999.999.999,99 — normalizada com 2 casas.
 */
export const SdQuantitySchema = z
  .union([z.number(), z.string().trim()])
  .transform((value, ctx) => {
    const n =
      typeof value === 'number' ? value : Number(value.replace(',', '.'))
    const rounded = Math.round(n * 100) / 100
    if (!Number.isFinite(n) || rounded <= 0 || rounded > 9_999_999_999.99) {
      ctx.addIssue({ code: 'custom', message: 'Quantidade inválida' })
      return z.NEVER
    }
    return rounded.toFixed(2)
  })

const description = z
  .string()
  .trim()
  .min(1, 'Descrição é obrigatória')
  .max(500, 'Descrição muito longa')

export const CreateSdTicketCostSchema = z.object({
  category: SdCostCategoryEnum.default('OTHER'),
  description,
  quantity: SdQuantitySchema.default('1.00'),
  unitCost: SdMoneySchema,
  billable: z.boolean().default(false),
  incurredAt: z.coerce.date().optional(),
  /** Técnico (mão de obra). */
  userId: sdId.nullable().optional(),
})
export type CreateSdTicketCostDTO = z.infer<typeof CreateSdTicketCostSchema>

export const UpdateSdTicketCostSchema = z
  .object({
    category: SdCostCategoryEnum.optional(),
    description: description.optional(),
    quantity: SdQuantitySchema.optional(),
    unitCost: SdMoneySchema.optional(),
    billable: z.boolean().optional(),
    incurredAt: z.coerce.date().optional(),
    userId: sdId.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdTicketCostDTO = z.infer<typeof UpdateSdTicketCostSchema>
