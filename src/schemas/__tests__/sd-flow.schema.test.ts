import { describe, expect, it } from 'vitest'
import {
  CreateSdCalendarSchema,
  isValidTimeZone,
  SdHolidaysSchema,
  SdWeeklyScheduleSchema,
  UpdateSdCalendarSchema,
} from '../sd-calendar.schema'
import {
  CreateSdPhaseSchema,
  ListSdPhasesSchema,
  ReorderSdPhasesSchema,
  SaveSdPhaseTransitionsSchema,
  SdPhaseRequiredFieldSchema,
  SdPhaseTransitionsQuerySchema,
  UpdateSdPhaseSchema,
} from '../sd-phase.schema'
import {
  CreateSdSlaPolicySchema,
  SdSlaTargetsSchema,
  UpdateSdSlaPolicySchema,
} from '../sd-sla-policy.schema'

describe('phase schemas', () => {
  it('applies defaults and dedupes required fields', () => {
    expect(
      CreateSdPhaseSchema.parse({
        ticketType: 'INCIDENT',
        name: 'Resolvido',
        category: 'RESOLVED',
        requiredFields: ['solution', 'solution', 'customFields.serial'],
      }),
    ).toEqual({
      ticketType: 'INCIDENT',
      name: 'Resolvido',
      category: 'RESOLVED',
      completionPercent: 0,
      isInitial: false,
      pausesSla: false,
      requiresApproval: false,
      requiredFields: ['solution', 'customFields.serial'],
      wipLimit: 0,
      active: true,
    })
  })

  it('validates percent and required fields', () => {
    const base = { ticketType: 'INCIDENT', name: 'x', category: 'NEW' }
    expect(
      CreateSdPhaseSchema.safeParse({ ...base, completionPercent: 101 })
        .success,
    ).toBe(false)
    expect(SdPhaseRequiredFieldSchema.safeParse('title').success).toBe(false)
    expect(
      SdPhaseRequiredFieldSchema.safeParse('customFields.1x').success,
    ).toBe(false)
  })

  it('validates update, list, reorder and query', () => {
    expect(UpdateSdPhaseSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdPhaseSchema.parse({ wipLimit: 5 })).toEqual({ wipLimit: 5 })
    expect(ListSdPhasesSchema.parse({})).toEqual({ includeInactive: false })
    expect(
      ReorderSdPhasesSchema.safeParse({ ticketType: 'CHANGE', orderedIds: [] })
        .success,
    ).toBe(false)
    expect(SdPhaseTransitionsQuerySchema.safeParse({}).success).toBe(false)
  })

  it('validates transitions', () => {
    expect(
      SaveSdPhaseTransitionsSchema.parse({
        transitions: [
          {
            fromPhaseId: 'a',
            toPhaseId: 'b',
            allowedDepartmentIds: ['d', 'd'],
          },
          { fromPhaseId: 'b', toPhaseId: 'a' },
        ],
      }),
    ).toEqual({
      transitions: [
        { fromPhaseId: 'a', toPhaseId: 'b', allowedDepartmentIds: ['d'] },
        { fromPhaseId: 'b', toPhaseId: 'a', allowedDepartmentIds: [] },
      ],
    })
    expect(
      SaveSdPhaseTransitionsSchema.safeParse({
        transitions: [{ fromPhaseId: 'a', toPhaseId: 'a' }],
      }).success,
    ).toBe(false)
    expect(
      SaveSdPhaseTransitionsSchema.safeParse({
        transitions: [
          { fromPhaseId: 'a', toPhaseId: 'b' },
          { fromPhaseId: 'a', toPhaseId: 'b' },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('calendar schemas', () => {
  it('validates timezones', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true)
    expect(isValidTimeZone('Mars/Base')).toBe(false)
  })

  it('sorts intervals and fills missing days', () => {
    const parsed = SdWeeklyScheduleSchema.parse({
      mon: [
        ['13:00', '18:00'],
        ['08:00', '12:00'],
      ],
      sun: [['00:00', '24:00']],
    })
    expect(parsed.mon).toEqual([
      ['08:00', '12:00'],
      ['13:00', '18:00'],
    ])
    expect(parsed.tue).toEqual([])
  })

  it('rejects overlapping, inverted and invalid intervals', () => {
    expect(
      SdWeeklyScheduleSchema.safeParse({
        mon: [
          ['08:00', '12:00'],
          ['11:00', '13:00'],
        ],
      }).success,
    ).toBe(false)
    expect(
      SdWeeklyScheduleSchema.safeParse({ mon: [['12:00', '08:00']] }).success,
    ).toBe(false)
    expect(
      SdWeeklyScheduleSchema.safeParse({ mon: [['25:00', '26:00']] }).success,
    ).toBe(false)
  })

  it('sorts holidays and rejects duplicates', () => {
    expect(
      SdHolidaysSchema.parse([
        { date: '2026-12-25', name: 'Natal' },
        { date: '2026-01-01', name: 'Ano novo', recurring: true },
      ]).map((h) => h.date),
    ).toEqual(['2026-01-01', '2026-12-25'])
    expect(
      SdHolidaysSchema.safeParse([
        { date: '2026-12-25', name: 'Natal' },
        { date: '2026-12-25', name: 'Outro' },
      ]).success,
    ).toBe(false)
  })

  it('requires business hours unless 24x7', () => {
    expect(CreateSdCalendarSchema.safeParse({ name: 'X' }).success).toBe(false)
    const ok = CreateSdCalendarSchema.parse({ name: 'X', is24x7: true })
    expect(ok.timezone).toBe('America/Sao_Paulo')
    expect(ok.isDefault).toBe(false)
    expect(
      CreateSdCalendarSchema.safeParse({
        name: 'X',
        schedule: { mon: [['08:00', '18:00']] },
      }).success,
    ).toBe(true)
    expect(
      CreateSdCalendarSchema.safeParse({
        name: 'X',
        is24x7: true,
        timezone: 'x',
      }).success,
    ).toBe(false)
  })

  it('validates updates', () => {
    expect(UpdateSdCalendarSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdCalendarSchema.safeParse({ name: 'Y' }).success).toBe(true)
    expect(UpdateSdCalendarSchema.safeParse({ schedule: {} }).success).toBe(
      false,
    )
    expect(
      UpdateSdCalendarSchema.safeParse({ schedule: {}, is24x7: true }).success,
    ).toBe(true)
  })
})

describe('SLA policy schemas', () => {
  const target = {
    priorityId: 'p1',
    firstResponseMinutes: 30,
    resolutionMinutes: 240,
  }

  it('validates targets', () => {
    expect(SdSlaTargetsSchema.parse([target])).toEqual([target])
    expect(
      SdSlaTargetsSchema.safeParse([{ ...target, resolutionMinutes: 10 }])
        .success,
    ).toBe(false)
    expect(SdSlaTargetsSchema.safeParse([target, target]).success).toBe(false)
  })

  it('applies create defaults', () => {
    expect(CreateSdSlaPolicySchema.parse({ name: 'Padrão' })).toEqual({
      kind: 'SLA',
      name: 'Padrão',
      conditions: [],
      isDefault: false,
      active: true,
      targets: [],
    })
  })

  it('requires a field on update', () => {
    expect(UpdateSdSlaPolicySchema.safeParse({}).success).toBe(false)
    expect(UpdateSdSlaPolicySchema.parse({ kind: 'OLA' })).toEqual({
      kind: 'OLA',
    })
  })
})
