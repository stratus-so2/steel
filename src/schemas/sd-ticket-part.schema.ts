import z from 'zod'
import { sdId } from './sd-config.schema'
import { SdMoneySchema } from './sd-part.schema'

export const SD_PART_STATUSES = [
  'REQUESTED',
  'RESERVED',
  'INSTALLED',
  'RETURNED',
  'CANCELED',
] as const
export const SdPartStatusEnum = z.enum(SD_PART_STATUSES)
export type SdPartStatusValue = (typeof SD_PART_STATUSES)[number]

/**
 * Fluxo de status da peça no chamado: solicitada → reservada → instalada →
 * devolvida; solicitada/reservada podem ser canceladas. Devolvida e
 * cancelada são finais.
 */
export const SD_PART_TRANSITIONS: Record<
  SdPartStatusValue,
  readonly SdPartStatusValue[]
> = {
  REQUESTED: ['RESERVED', 'INSTALLED', 'CANCELED'],
  RESERVED: ['REQUESTED', 'INSTALLED', 'CANCELED'],
  INSTALLED: ['RETURNED'],
  RETURNED: [],
  CANCELED: [],
}

export function canMoveSdPart(
  from: SdPartStatusValue,
  to: SdPartStatusValue,
): boolean {
  return from === to || SD_PART_TRANSITIONS[from].includes(to)
}

const quantity = z.coerce
  .number()
  .int('Quantidade deve ser inteira')
  .min(1, 'Quantidade mínima 1')
  .max(1_000_000)
const text = (max: number) => z.string().trim().max(max).nullable().optional()

/**
 * Peça do chamado: do catálogo (`partId` — nome, SKU e custo vêm dele se
 * omitidos) ou texto livre (`name` obrigatório). Pode nascer já instalada.
 */
export const CreateSdTicketPartSchema = z
  .object({
    partId: sdId.nullable().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    sku: text(64),
    quantity: quantity.default(1),
    unitCost: SdMoneySchema.optional(),
    serialNumber: text(120),
    notes: text(2000),
    status: z.enum(['REQUESTED', 'RESERVED', 'INSTALLED']).default('REQUESTED'),
  })
  .refine((data) => Boolean(data.partId) || Boolean(data.name), {
    message: 'Escolha uma peça do catálogo ou informe o nome',
    path: ['name'],
  })
export type CreateSdTicketPartDTO = z.infer<typeof CreateSdTicketPartSchema>

export const UpdateSdTicketPartSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sku: text(64),
    quantity: quantity.optional(),
    unitCost: SdMoneySchema.optional(),
    serialNumber: text(120),
    notes: text(2000),
    status: SdPartStatusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdTicketPartDTO = z.infer<typeof UpdateSdTicketPartSchema>
