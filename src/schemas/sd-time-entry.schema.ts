import z from 'zod'
import { sdId } from './sd-config.schema'

/**
 * Apontamento de horas no chamado: cronômetro (um aberto por usuário) e
 * lançamento manual. Os minutos cobrados nunca vêm do cliente — o service
 * calcula a partir de início/fim e das regras do contrato
 * (`src/lib/servicedesk/billing.ts`).
 */

export const SD_TIME_ENTRY_SOURCES = ['TIMER', 'MANUAL'] as const
export const SdTimeEntrySourceEnum = z.enum(SD_TIME_ENTRY_SOURCES)

/**
 * Ações do cronômetro. O cronômetro é **por trecho**: `start`/`resume` abrem
 * um apontamento (fim vazio) e `pause`/`stop` fecham o aberto, consolidando
 * minutos, janela e valor. São quatro nomes para a interface falar a língua
 * do agente; no banco são duas operações.
 */
export const SD_TIMER_ACTIONS = ['start', 'pause', 'resume', 'stop'] as const
export const SdTimerActionEnum = z.enum(SD_TIMER_ACTIONS)

const description = z.string().trim().max(1000).nullable().optional()

export const SdTimerActionSchema = z.object({
  action: SdTimerActionEnum,
  description,
})
export type SdTimerActionDTO = z.infer<typeof SdTimerActionSchema>

export const CreateSdTimeEntrySchema = z
  .object({
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    billable: z.boolean().default(true),
    description,
    /** Apontar por outro agente: só admins do módulo. */
    userId: sdId.nullable().optional(),
  })
  .refine((data) => data.endedAt > data.startedAt, {
    message: 'O fim deve ser depois do início',
    path: ['endedAt'],
  })
export type CreateSdTimeEntryDTO = z.infer<typeof CreateSdTimeEntrySchema>

export const UpdateSdTimeEntrySchema = z
  .object({
    startedAt: z.coerce.date().optional(),
    endedAt: z.coerce.date().optional(),
    billable: z.boolean().optional(),
    description,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
  .refine(
    (data) => !data.startedAt || !data.endedAt || data.endedAt > data.startedAt,
    { message: 'O fim deve ser depois do início', path: ['endedAt'] },
  )
export type UpdateSdTimeEntryDTO = z.infer<typeof UpdateSdTimeEntrySchema>
