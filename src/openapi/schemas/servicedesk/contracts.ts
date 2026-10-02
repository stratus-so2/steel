import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs dos contratos de atendimento e do apontamento de horas
 * (`types/sd-contract.d.ts`, `types/sd-time-entry.d.ts`). Dinheiro sempre
 * como string decimal com 2 casas; minutos como inteiro.
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])
const ContractStatus = z.enum(['DRAFT', 'ACTIVE', 'SUSPENDED', 'ENDED'])
const BillingCycle = z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY'])
const RateWindow = z.enum([
  'BUSINESS_HOURS',
  'AFTER_HOURS',
  'WEEKEND',
  'HOLIDAY',
])

const UserSummary = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable(),
})

export const SdContractRateDTO = dto(
  'SdContractRate',
  z.object({
    id: z.string(),
    ticketType: TicketType.nullable().meta({
      description: '`null` vale para qualquer tipo de chamado.',
    }),
    priorityId: z.string().nullable().meta({
      description: '`null` vale para qualquer prioridade.',
    }),
    priorityName: z.string().nullable(),
    window: RateWindow,
    hourlyRate: z.string().meta({ example: '300.00' }),
    multiplier: z.string().meta({
      example: '1.50',
      description: 'Multiplicador do valor na janela (plantão, feriado).',
    }),
    position: z.number().int().meta({
      description: 'Ordem de avaliação: a primeira regra que casa vence.',
    }),
  }),
)

export const SdContractPeriodDTO = dto(
  'SdContractPeriod',
  z.object({
    id: z.string(),
    contractId: z.string(),
    periodStart: dateTime(),
    periodEnd: dateTime().meta({ description: 'Exclusivo.' }),
    status: z.enum(['OPEN', 'CLOSED']),
    includedMinutes: z.number().int().meta({
      description: 'Franquia do período, já com o saldo acumulado.',
    }),
    usedMinutes: z.number().int(),
    billableMinutes: z.number().int(),
    overageMinutes: z.number().int(),
    carriedMinutes: z.number().int().meta({
      description: 'Franquia que sobrou e vai para o período seguinte.',
    }),
    amount: z.string().meta({
      example: '1250.00',
      description: 'Valor a faturar: só o excedente da franquia.',
    }),
    closedAt: nullableDateTime(),
    closedBy: UserSummary.nullable().meta({
      description: '`null` quando o fechamento foi do worker.',
    }),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdContractDTO = dto(
  'SdContract',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    customer: z.object({
      id: z.string(),
      name: z.string(),
      tradeName: z.string().nullable(),
    }),
    name: z.string().meta({ example: 'Suporte mensal 20 h' }),
    code: z.string().nullable(),
    status: ContractStatus,
    startsAt: dateTime(),
    endsAt: nullableDateTime(),
    billingCycle: BillingCycle,
    includedMinutes: z.number().int().meta({ example: 1200 }),
    carryOver: z.boolean(),
    hourlyRate: z.string().meta({ example: '150.00' }),
    overtimeRate: z.string().nullable().meta({
      description: 'Hora além da franquia; `null` = o mesmo da hora normal.',
    }),
    roundingMinutes: z.number().int().meta({
      example: 15,
      description: 'Arredondamento do apontamento, sempre para cima.',
    }),
    minimumMinutes: z.number().int().meta({
      example: 30,
      description: 'Mínimo no primeiro apontamento do dia naquele chamado.',
    }),
    ticketTypes: z.array(TicketType).meta({
      description: 'Vazio = cobre todos os tipos.',
    }),
    slaPolicyId: z.string().nullable(),
    slaPolicyName: z.string().nullable(),
    notes: z.string().nullable(),
    rates: z.array(SdContractRateDTO),
    currentPeriod: SdContractPeriodDTO.nullable(),
    createdBy: UserSummary,
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdContractSummaryDTO = dto(
  'SdContractSummary',
  z.object({
    contract: SdContractDTO.nullable(),
    period: SdContractPeriodDTO.nullable(),
    percentUsed: z.number().nullable().meta({
      description: '% da franquia consumida; `null` sem franquia.',
    }),
  }),
)

export const SdTimeEntryDTO = dto(
  'SdTimeEntry',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    contractId: z.string().nullable(),
    periodId: z.string().nullable(),
    source: z.enum(['TIMER', 'MANUAL']),
    user: UserSummary,
    startedAt: dateTime(),
    endedAt: nullableDateTime().meta({
      description: '`null` = cronômetro em andamento.',
    }),
    minutes: z.number().int().meta({
      description:
        'Minutos já arredondados pelas regras do contrato (0 enquanto o cronômetro roda).',
    }),
    billable: z.boolean(),
    window: RateWindow,
    amount: z.string().nullable().meta({
      example: '225.00',
      description: '`null` quando o chamado não tem contrato.',
    }),
    description: z.string().nullable(),
    editable: z.boolean().meta({
      description:
        'O autor com o período aberto, ou um admin do módulo, pode alterar.',
    }),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdTimeEntryListDTO = dto(
  'SdTimeEntryList',
  z.object({
    items: z.array(SdTimeEntryDTO),
    summary: z.object({
      totalMinutes: z.number().int(),
      billableMinutes: z.number().int(),
      nonBillableMinutes: z.number().int(),
      amount: z.string(),
      byWindow: z.array(
        z.object({ window: RateWindow, minutes: z.number().int() }),
      ),
    }),
    running: SdTimeEntryDTO.nullable().meta({
      description:
        'Cronômetro aberto de quem pediu — pode ser de outro chamado.',
    }),
    contract: z
      .object({
        id: z.string(),
        name: z.string(),
        code: z.string().nullable(),
        includedMinutes: z.number().int(),
        roundingMinutes: z.number().int(),
        minimumMinutes: z.number().int(),
        period: SdContractPeriodDTO.nullable(),
      })
      .nullable(),
  }),
)
