import z from 'zod'
import { sdName } from './sd-config.schema'

export const SD_WEEK_DAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const
export type SdWeekDay = (typeof SD_WEEK_DAYS)[number]

/** `true` quando o runtime reconhece o fuso IANA (ex.: `America/Sao_Paulo`). */
export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

const time = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Horário inválido (HH:MM)')

const interval = z.tuple([time, time]).refine(([start, end]) => start < end, {
  message: 'O fim do intervalo precisa ser depois do início',
})

const daySchedule = z
  .array(interval)
  .max(6, 'No máximo 6 intervalos por dia')
  .superRefine((intervals, ctx) => {
    const sorted = [...intervals].sort((a, b) => a[0].localeCompare(b[0]))
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i][0] < sorted[i - 1][1]) {
        ctx.addIssue({
          code: 'custom',
          message: `Intervalos sobrepostos (${sorted[i - 1].join('–')} e ${sorted[i].join('–')})`,
        })
        return
      }
    }
  })
  .transform((intervals) =>
    [...intervals].sort((a, b) => a[0].localeCompare(b[0])),
  )

/** `{"mon":[["08:00","12:00"],["13:00","18:00"]], ..., "sun":[]}` */
export const SdWeeklyScheduleSchema = z.object({
  mon: daySchedule.default([]),
  tue: daySchedule.default([]),
  wed: daySchedule.default([]),
  thu: daySchedule.default([]),
  fri: daySchedule.default([]),
  sat: daySchedule.default([]),
  sun: daySchedule.default([]),
})
export type SdWeeklySchedule = z.infer<typeof SdWeeklyScheduleSchema>

export const SdHolidaySchema = z.object({
  date: z.iso.date('Data inválida (AAAA-MM-DD)'),
  name: z.string().trim().min(1).max(120),
  /** Repete todo ano no mesmo dia/mês (ex.: Natal). */
  recurring: z.boolean().default(false),
})
export type SdHoliday = z.infer<typeof SdHolidaySchema>

export const SdHolidaysSchema = z
  .array(SdHolidaySchema)
  .max(400)
  .refine((list) => new Set(list.map((h) => h.date)).size === list.length, {
    message: 'Há feriados repetidos na mesma data',
  })
  .transform((list) => [...list].sort((a, b) => a.date.localeCompare(b.date)))

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Fuso horário inválido')

function hasBusinessHours(schedule: SdWeeklySchedule): boolean {
  return SD_WEEK_DAYS.some((day) => schedule[day].length > 0)
}

export const CreateSdCalendarSchema = z
  .object({
    name: sdName,
    timezone: timezone.default('America/Sao_Paulo'),
    schedule: SdWeeklyScheduleSchema.default({
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    }),
    holidays: SdHolidaysSchema.default([]),
    is24x7: z.boolean().default(false),
    isDefault: z.boolean().default(false),
  })
  .refine((c) => c.is24x7 || hasBusinessHours(c.schedule), {
    message: 'Defina ao menos um intervalo de expediente (ou marque 24×7)',
    path: ['schedule'],
  })
export type CreateSdCalendarDTO = z.infer<typeof CreateSdCalendarSchema>

export const UpdateSdCalendarSchema = z
  .object({
    name: sdName.optional(),
    timezone: timezone.optional(),
    schedule: SdWeeklyScheduleSchema.optional(),
    holidays: SdHolidaysSchema.optional(),
    is24x7: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((c) => Object.keys(c).length > 0, {
    message: 'Informe ao menos um campo',
  })
  .refine((c) => !c.schedule || c.is24x7 || hasBusinessHours(c.schedule), {
    message: 'Defina ao menos um intervalo de expediente (ou marque 24×7)',
    path: ['schedule'],
  })
export type UpdateSdCalendarDTO = z.infer<typeof UpdateSdCalendarSchema>
