import z from 'zod'
import { isValidTimeZone, SD_WEEK_DAYS } from './sd-calendar.schema'
import { sdId, sdName } from './sd-config.schema'

/**
 * Janelas do calendário de mudanças (`SdChangeWindow`): manutenção (quando
 * pode mexer) ou congelamento (quando não pode). A recorrência é uma RRULE
 * simplificada guardada em JSON; a expansão em ocorrências mora na lib pura
 * `src/lib/servicedesk/change-calendar.ts`.
 *
 * O período (fim depois do início, duração máxima, `until` coerente) é
 * conferido no **service**, que devolve `SD_CHANGE_WINDOW_INVALID` — assim a
 * UI distingue "campo mal preenchido" (`VALIDATION_ERROR`) de "janela
 * impossível".
 */

export const SD_CHANGE_WINDOW_KINDS = ['MAINTENANCE', 'FREEZE'] as const
export type SdChangeWindowKindInput = (typeof SD_CHANGE_WINDOW_KINDS)[number]

export const SD_CHANGE_RECURRENCE_FREQS = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
] as const

/** Quantas ocorrências a expansão aceita gerar por janela. */
export const SD_CHANGE_RECURRENCE_MAX_COUNT = 365

const timezone = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Fuso horário inválido')

/**
 * `{"freq":"WEEKLY","interval":1,"byDay":["sat"],"count":12}` — repete a
 * janela a partir de `startsAt`. `byDay` só vale em `WEEKLY`; sem ele a
 * repetição semanal usa o dia da semana do início. `until` (data AAAA-MM-DD,
 * inclusive) e `count` limitam a série; sem nenhum dos dois a série é aberta
 * e a expansão para no fim do intervalo consultado.
 */
export const SdChangeRecurrenceSchema = z
  .object({
    freq: z.enum(SD_CHANGE_RECURRENCE_FREQS),
    interval: z.number().int().min(1).max(52).default(1),
    byDay: z.array(z.enum(SD_WEEK_DAYS)).max(7).default([]),
    until: z.iso.date('Data inválida (AAAA-MM-DD)').nullish(),
    count: z
      .number()
      .int()
      .min(1)
      .max(SD_CHANGE_RECURRENCE_MAX_COUNT)
      .nullish(),
  })
  .refine((r) => r.freq === 'WEEKLY' || r.byDay.length === 0, {
    message: 'Dias da semana só se aplicam à repetição semanal',
    path: ['byDay'],
  })
  .refine((r) => !(r.until && r.count), {
    message: 'Informe um limite: data final ou número de ocorrências',
    path: ['count'],
  })
  .transform((r) => ({
    ...r,
    byDay: SD_WEEK_DAYS.filter((day) => r.byDay.includes(day)),
    until: r.until ?? null,
    count: r.count ?? null,
  }))
export type SdChangeRecurrenceInput = z.infer<typeof SdChangeRecurrenceSchema>

const windowFields = {
  name: sdName,
  kind: z.enum(SD_CHANGE_WINDOW_KINDS),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  recurrence: SdChangeRecurrenceSchema.nullish(),
  timezone,
  /** Itens de configuração alvo; vazio = toda a workspace. */
  configItemIds: z.array(sdId).max(100),
  /** Departamentos alvo; vazio = todos. */
  departmentIds: z.array(sdId).max(50),
  description: z.string().trim().max(2000).nullish(),
}

export const CreateSdChangeWindowSchema = z.object({
  ...windowFields,
  kind: windowFields.kind.default('MAINTENANCE'),
  timezone: timezone.default('America/Sao_Paulo'),
  configItemIds: windowFields.configItemIds.default([]),
  departmentIds: windowFields.departmentIds.default([]),
})
export type CreateSdChangeWindowDTO = z.infer<typeof CreateSdChangeWindowSchema>

export const UpdateSdChangeWindowSchema = z
  .object({
    name: windowFields.name.optional(),
    kind: windowFields.kind.optional(),
    startsAt: windowFields.startsAt.optional(),
    endsAt: windowFields.endsAt.optional(),
    recurrence: windowFields.recurrence,
    timezone: timezone.optional(),
    configItemIds: windowFields.configItemIds.optional(),
    departmentIds: windowFields.departmentIds.optional(),
    description: windowFields.description,
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdChangeWindowDTO = z.infer<typeof UpdateSdChangeWindowSchema>

/** Intervalo consultado pelo calendário (`?from=&to=`, datas ISO). */
export const SdChangeCalendarQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    kind: z.enum(SD_CHANGE_WINDOW_KINDS).optional(),
  })
  .refine((q) => q.to.getTime() > q.from.getTime(), {
    message: 'O fim do intervalo precisa ser depois do início',
    path: ['to'],
  })
export type SdChangeCalendarQueryDTO = z.infer<
  typeof SdChangeCalendarQuerySchema
>
