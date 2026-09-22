import type { SdBusinessCalendar } from '@prisma/client'
import z from 'zod'
import {
  SdHolidaySchema,
  SdWeeklyScheduleSchema,
} from '@/src/schemas/sd-calendar.schema'
import type {
  SdBusinessCalendarDTO,
  SdHolidayDTO,
  SdWeeklyScheduleDTO,
} from '@/types/sd-config'

const EMPTY_SCHEDULE: SdWeeklyScheduleDTO = {
  mon: [],
  tue: [],
  wed: [],
  thu: [],
  fri: [],
  sat: [],
  sun: [],
}

/** JSON salvo → expediente semanal (JSON inválido vira semana vazia). */
export function toSdWeeklySchedule(value: unknown): SdWeeklyScheduleDTO {
  const parsed = SdWeeklyScheduleSchema.safeParse(value)
  return parsed.success ? parsed.data : { ...EMPTY_SCHEDULE }
}

/** JSON salvo → feriados válidos (itens inválidos são descartados). */
export function toSdHolidays(value: unknown): SdHolidayDTO[] {
  const parsed = z.array(z.unknown()).safeParse(value)
  if (!parsed.success) return []
  return parsed.data.flatMap((item) => {
    const holiday = SdHolidaySchema.safeParse(item)
    return holiday.success ? [holiday.data] : []
  })
}

export function toSdCalendarDTO(
  calendar: SdBusinessCalendar,
): SdBusinessCalendarDTO {
  return {
    id: calendar.id,
    name: calendar.name,
    timezone: calendar.timezone,
    schedule: toSdWeeklySchedule(calendar.schedule),
    holidays: toSdHolidays(calendar.holidays),
    is24x7: calendar.is24x7,
    isDefault: calendar.isDefault,
    createdAt: calendar.createdAt.toISOString(),
    updatedAt: calendar.updatedAt.toISOString(),
  }
}
