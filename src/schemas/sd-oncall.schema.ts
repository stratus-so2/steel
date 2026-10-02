import z from 'zod'
import { isValidTimeZone } from './sd-calendar.schema'
import { booleanQuery, sdId, sdName } from './sd-config.schema'

/**
 * Escalas de plantão (on-call) do ServiceDesk: a escala em si, suas camadas
 * (1 = primeira chamada, 2 = retaguarda…), os participantes do rodízio e as
 * trocas pontuais.
 *
 * O rodízio é determinístico: `rotationStart` + `handoffTime` no fuso da
 * escala definem a âncora, e cada período (`DAILY` = 1 dia, `WEEKLY` = 7,
 * `BIWEEKLY` = 14) passa a bola para o próximo participante da camada. Com
 * `calendarId`, a escala só vale **fora** do expediente do calendário.
 */

export const SD_ONCALL_ROTATIONS = ['DAILY', 'WEEKLY', 'BIWEEKLY'] as const
export const SdOnCallRotationEnum = z.enum(SD_ONCALL_ROTATIONS)
export type SdOnCallRotationInput = z.infer<typeof SdOnCallRotationEnum>

/** Hora da virada do plantão, no fuso da escala (`HH:MM`, 24 h). */
export const sdHandoffTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (HH:MM)')

const timezone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Fuso horário inválido')

const nullableId = sdId.nullable().optional()

/** 1 = primeira chamada, 2 = retaguarda… */
export const sdOnCallLevel = z
  .number()
  .int('A camada é um número inteiro')
  .min(1, 'A primeira camada é a 1')
  .max(10, 'No máximo 10 camadas')

export const CreateSdOnCallScheduleSchema = z.object({
  name: sdName,
  departmentId: nullableId,
  timezone: timezone.default('America/Sao_Paulo'),
  rotation: SdOnCallRotationEnum.default('WEEKLY'),
  /** Começo do rodízio: o primeiro participante cobre o período desta data. */
  rotationStart: z.coerce.date(),
  handoffTime: sdHandoffTime.default('09:00'),
  /** Calendário de expediente: a escala só vale fora dele. */
  calendarId: nullableId,
  active: z.boolean().default(true),
})
export type CreateSdOnCallScheduleDTO = z.infer<
  typeof CreateSdOnCallScheduleSchema
>

export const UpdateSdOnCallScheduleSchema = z
  .object({
    name: sdName.optional(),
    departmentId: nullableId,
    timezone: timezone.optional(),
    rotation: SdOnCallRotationEnum.optional(),
    rotationStart: z.coerce.date().optional(),
    handoffTime: sdHandoffTime.optional(),
    calendarId: nullableId,
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdOnCallScheduleDTO = z.infer<
  typeof UpdateSdOnCallScheduleSchema
>

export const ListSdOnCallSchedulesSchema = z.object({
  includeInactive: booleanQuery,
  departmentId: sdId.optional(),
})
export type ListSdOnCallSchedulesDTO = z.infer<
  typeof ListSdOnCallSchedulesSchema
>

export const CreateSdOnCallLayerSchema = z.object({
  name: sdName,
  level: sdOnCallLevel.default(1),
})
export type CreateSdOnCallLayerDTO = z.infer<typeof CreateSdOnCallLayerSchema>

export const UpdateSdOnCallLayerSchema = z
  .object({ name: sdName.optional(), level: sdOnCallLevel.optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdOnCallLayerDTO = z.infer<typeof UpdateSdOnCallLayerSchema>

/**
 * Substitui a lista de participantes da camada: a **ordem do array é a ordem
 * do rodízio**, então o mesmo endpoint adiciona, remove e reordena.
 */
export const SetSdOnCallParticipantsSchema = z.object({
  userIds: z
    .array(sdId)
    .max(50, 'No máximo 50 participantes por camada')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Participante repetido na camada',
    }),
})
export type SetSdOnCallParticipantsDTO = z.infer<
  typeof SetSdOnCallParticipantsSchema
>

export const CreateSdOnCallOverrideSchema = z
  .object({
    scheduleId: sdId,
    /** Camada coberta; sem camada, a troca vale para a escala inteira. */
    layerId: nullableId,
    userId: sdId,
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'O fim da troca precisa ser depois do início',
    path: ['endsAt'],
  })
export type CreateSdOnCallOverrideDTO = z.infer<
  typeof CreateSdOnCallOverrideSchema
>

export const ListSdOnCallOverridesSchema = z.object({
  scheduleId: sdId.optional(),
  /** Janela consultada (padrão: as trocas que ainda não terminaram). */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})
export type ListSdOnCallOverridesDTO = z.infer<
  typeof ListSdOnCallOverridesSchema
>

/** Linha do tempo da escala: `days` dias a partir de `from` (agora). */
export const SdOnCallTimelineSchema = z.object({
  from: z.coerce.date().optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
})
export type SdOnCallTimelineDTO = z.infer<typeof SdOnCallTimelineSchema>

/** Quem está de plantão agora (ou no instante `at`). */
export const SdOnCallNowSchema = z.object({
  departmentId: sdId.optional(),
  at: z.coerce.date().optional(),
})
export type SdOnCallNowDTO = z.infer<typeof SdOnCallNowSchema>
