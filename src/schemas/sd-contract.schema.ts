import z from 'zod'
import { sdId, sdName } from './sd-config.schema'
import { SdMoneySchema } from './sd-part.schema'
import { SdTicketTypeEnum } from './sd-rule.schema'

/**
 * Contratos de atendimento: franquia de horas, valor da hora e as regras
 * (tipo × prioridade × janela) que decidem quanto custa cada apontamento.
 * Dinheiro entra como número ou string (vírgula ou ponto) e sai normalizado
 * com 2 casas; minutos são inteiros.
 */

export const SD_CONTRACT_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'SUSPENDED',
  'ENDED',
] as const
export const SdContractStatusEnum = z.enum(SD_CONTRACT_STATUSES)

export const SD_CONTRACT_BILLING_CYCLES = [
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
] as const
export const SdContractBillingCycleEnum = z.enum(SD_CONTRACT_BILLING_CYCLES)

export const SD_RATE_WINDOWS = [
  'BUSINESS_HOURS',
  'AFTER_HOURS',
  'WEEKEND',
  'HOLIDAY',
] as const
export const SdRateWindowEnum = z.enum(SD_RATE_WINDOWS)

/** Multiplicador da janela (plantão, fim de semana): 0,01 a 99,99. */
export const SdMultiplierSchema = z
  .union([z.number(), z.string().trim()])
  .transform((value, ctx) => {
    const n =
      typeof value === 'number' ? value : Number(value.replace(',', '.'))
    const rounded = Math.round(n * 100) / 100
    if (!Number.isFinite(n) || rounded < 0.01 || rounded > 99.99) {
      ctx.addIssue({ code: 'custom', message: 'Multiplicador inválido' })
      return z.NEVER
    }
    return rounded.toFixed(2)
  })

const includedMinutes = z.number().int().min(0).max(1_000_000)
const roundingMinutes = z.number().int().min(1).max(480)
const minimumMinutes = z.number().int().min(0).max(1440)
const notes = z.string().trim().max(2000).nullable().optional()
const code = z.string().trim().max(64).nullable().optional()

/** Uma linha da tabela de valores do contrato. */
export const SdContractRateInputSchema = z.object({
  /** `null` = vale para qualquer tipo. */
  ticketType: SdTicketTypeEnum.nullable().default(null),
  /** `null` = vale para qualquer prioridade. */
  priorityId: sdId.nullable().default(null),
  window: SdRateWindowEnum.default('BUSINESS_HOURS'),
  hourlyRate: SdMoneySchema,
  multiplier: SdMultiplierSchema.default('1.00'),
})
export type SdContractRateInputDTO = z.infer<typeof SdContractRateInputSchema>

const rates = z.array(SdContractRateInputSchema).max(60)

const contractShape = {
  customerId: sdId,
  name: sdName,
  code,
  status: SdContractStatusEnum.default('DRAFT'),
  startsAt: z.coerce.date(),
  /** Vazio = sem data de término. */
  endsAt: z.coerce.date().nullable().optional(),
  billingCycle: SdContractBillingCycleEnum.default('MONTHLY'),
  includedMinutes: includedMinutes.default(0),
  carryOver: z.boolean().default(false),
  hourlyRate: SdMoneySchema.default('0.00'),
  /** Valor da hora além da franquia (vazio = o mesmo da hora normal). */
  overtimeRate: SdMoneySchema.nullable().optional(),
  roundingMinutes: roundingMinutes.default(1),
  minimumMinutes: minimumMinutes.default(0),
  /** Tipos cobertos (vazio = todos). */
  ticketTypes: z.array(SdTicketTypeEnum).max(4).default([]),
  slaPolicyId: sdId.nullable().optional(),
  notes,
}

export const CreateSdContractSchema = z
  .object({ ...contractShape, rates: rates.default([]) })
  .refine((data) => !data.endsAt || data.endsAt > data.startsAt, {
    message: 'O término deve ser depois do início',
    path: ['endsAt'],
  })
export type CreateSdContractDTO = z.infer<typeof CreateSdContractSchema>

export const UpdateSdContractSchema = z
  .object({
    customerId: sdId.optional(),
    name: sdName.optional(),
    code,
    status: SdContractStatusEnum.optional(),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    billingCycle: SdContractBillingCycleEnum.optional(),
    includedMinutes: includedMinutes.optional(),
    carryOver: z.boolean().optional(),
    hourlyRate: SdMoneySchema.optional(),
    overtimeRate: SdMoneySchema.nullable().optional(),
    roundingMinutes: roundingMinutes.optional(),
    minimumMinutes: minimumMinutes.optional(),
    ticketTypes: z.array(SdTicketTypeEnum).max(4).optional(),
    slaPolicyId: sdId.nullable().optional(),
    notes,
    /** Informado = substitui a tabela de valores inteira. */
    rates: rates.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
  .refine(
    (data) => !data.startsAt || !data.endsAt || data.endsAt > data.startsAt,
    {
      message: 'O término deve ser depois do início',
      path: ['endsAt'],
    },
  )
export type UpdateSdContractDTO = z.infer<typeof UpdateSdContractSchema>

function blank(value: unknown): unknown {
  return value === '' || value === null ? undefined : value
}

export const ListSdContractsSchema = z.object({
  customerId: z.preprocess(blank, sdId.optional()),
  status: z.preprocess(blank, SdContractStatusEnum.optional()),
  q: z.preprocess(blank, z.string().trim().max(200).optional()),
})
export type ListSdContractsDTO = z.infer<typeof ListSdContractsSchema>

/** Fechamento manual do período (vazio = o período corrente). */
export const CloseSdContractPeriodSchema = z.object({
  periodId: sdId.optional(),
})
export type CloseSdContractPeriodDTO = z.infer<
  typeof CloseSdContractPeriodSchema
>
