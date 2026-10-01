import { describe, expect, it } from 'vitest'
import {
  CreateSdOnCallLayerSchema,
  CreateSdOnCallOverrideSchema,
  CreateSdOnCallScheduleSchema,
  ListSdOnCallOverridesSchema,
  ListSdOnCallSchedulesSchema,
  SdOnCallNowSchema,
  SdOnCallTimelineSchema,
  SetSdOnCallParticipantsSchema,
  UpdateSdOnCallLayerSchema,
  UpdateSdOnCallScheduleSchema,
} from '../sd-oncall.schema'

const start = '2026-10-05T12:00:00.000Z'

describe('CreateSdOnCallScheduleSchema', () => {
  it('fills the defaults of a brazilian weekly rotation', () => {
    const parsed = CreateSdOnCallScheduleSchema.parse({
      name: '  Plantão de redes  ',
      rotationStart: start,
    })
    expect(parsed).toMatchObject({
      name: 'Plantão de redes',
      timezone: 'America/Sao_Paulo',
      rotation: 'WEEKLY',
      handoffTime: '09:00',
      active: true,
    })
    expect(parsed.rotationStart.toISOString()).toBe(start)
  })

  it('accepts the three rotations and a nullable department/calendar', () => {
    for (const rotation of ['DAILY', 'WEEKLY', 'BIWEEKLY'] as const) {
      expect(
        CreateSdOnCallScheduleSchema.parse({
          name: 'x',
          rotationStart: start,
          rotation,
          departmentId: null,
          calendarId: null,
        }).rotation,
      ).toBe(rotation)
    }
  })

  it('rejects an unknown timezone', () => {
    const result = CreateSdOnCallScheduleSchema.safeParse({
      name: 'x',
      rotationStart: start,
      timezone: 'Marte/Olympus',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Fuso horário inválido')
  })

  it.each([
    '9:00',
    '24:00',
    '09:60',
    '0900',
    '',
  ])('rejects the handoff time %s', (handoffTime) => {
    expect(
      CreateSdOnCallScheduleSchema.safeParse({
        name: 'x',
        rotationStart: start,
        handoffTime,
      }).success,
    ).toBe(false)
  })

  it('requires a name and a rotation start', () => {
    expect(CreateSdOnCallScheduleSchema.safeParse({}).success).toBe(false)
    expect(
      CreateSdOnCallScheduleSchema.safeParse({
        name: '   ',
        rotationStart: start,
      }).success,
    ).toBe(false)
  })
})

describe('UpdateSdOnCallScheduleSchema', () => {
  it('accepts a single field', () => {
    expect(UpdateSdOnCallScheduleSchema.parse({ active: false })).toEqual({
      active: false,
    })
  })

  it('refuses an empty payload', () => {
    const result = UpdateSdOnCallScheduleSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe('Informe ao menos um campo')
  })
})

describe('camadas', () => {
  it('defaults to the first call layer', () => {
    expect(CreateSdOnCallLayerSchema.parse({ name: 'Primeira' })).toEqual({
      name: 'Primeira',
      level: 1,
    })
  })

  it.each([0, -1, 11, 1.5])('rejects the level %s', (level) => {
    expect(
      CreateSdOnCallLayerSchema.safeParse({ name: 'x', level }).success,
    ).toBe(false)
  })

  it('requires a field on update', () => {
    expect(UpdateSdOnCallLayerSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdOnCallLayerSchema.parse({ level: 2 })).toEqual({ level: 2 })
  })
})

describe('SetSdOnCallParticipantsSchema', () => {
  it('keeps the order of the rotation', () => {
    expect(
      SetSdOnCallParticipantsSchema.parse({ userIds: ['u2', 'u1'] }).userIds,
    ).toEqual(['u2', 'u1'])
  })

  it('accepts an empty layer', () => {
    expect(
      SetSdOnCallParticipantsSchema.parse({ userIds: [] }).userIds,
    ).toEqual([])
  })

  it('rejects a repeated participant and a huge list', () => {
    const repeated = SetSdOnCallParticipantsSchema.safeParse({
      userIds: ['u1', 'u1'],
    })
    expect(repeated.success).toBe(false)
    expect(repeated.error?.issues[0].message).toBe(
      'Participante repetido na camada',
    )
    expect(
      SetSdOnCallParticipantsSchema.safeParse({
        userIds: Array.from({ length: 51 }, (_, i) => `u${i}`),
      }).success,
    ).toBe(false)
  })
})

describe('CreateSdOnCallOverrideSchema', () => {
  it('parses a window with a reason', () => {
    const parsed = CreateSdOnCallOverrideSchema.parse({
      scheduleId: 'sch-1',
      userId: 'u1',
      startsAt: '2026-10-07T00:00:00.000Z',
      endsAt: '2026-10-08T00:00:00.000Z',
      reason: '  Consulta  ',
    })
    expect(parsed.reason).toBe('Consulta')
    expect(parsed.layerId).toBeUndefined()
  })

  it('refuses a window that ends before it starts', () => {
    const result = CreateSdOnCallOverrideSchema.safeParse({
      scheduleId: 'sch-1',
      userId: 'u1',
      startsAt: '2026-10-08T00:00:00.000Z',
      endsAt: '2026-10-07T00:00:00.000Z',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      'O fim da troca precisa ser depois do início',
    )
  })

  it('refuses a zero-length window', () => {
    expect(
      CreateSdOnCallOverrideSchema.safeParse({
        scheduleId: 'sch-1',
        userId: 'u1',
        startsAt: '2026-10-07T00:00:00.000Z',
        endsAt: '2026-10-07T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('filtros e consultas', () => {
  it('reads the query string of the listings', () => {
    expect(ListSdOnCallSchedulesSchema.parse({})).toEqual({
      includeInactive: false,
    })
    expect(
      ListSdOnCallSchedulesSchema.parse({
        includeInactive: 'true',
        departmentId: 'dep-1',
      }),
    ).toEqual({ includeInactive: true, departmentId: 'dep-1' })
    expect(ListSdOnCallOverridesSchema.parse({}).limit).toBe(50)
    expect(ListSdOnCallOverridesSchema.parse({ limit: '10' }).limit).toBe(10)
    expect(
      ListSdOnCallOverridesSchema.safeParse({ limit: '500' }).success,
    ).toBe(false)
  })

  it('defaults the timeline to two weeks', () => {
    expect(SdOnCallTimelineSchema.parse({}).days).toBe(14)
    expect(SdOnCallTimelineSchema.parse({ days: '7' }).days).toBe(7)
    expect(SdOnCallTimelineSchema.safeParse({ days: '40' }).success).toBe(false)
    expect(
      SdOnCallTimelineSchema.parse({ from: start }).from?.toISOString(),
    ).toBe(start)
  })

  it('accepts a department and an instant on "now"', () => {
    expect(SdOnCallNowSchema.parse({})).toEqual({})
    expect(
      SdOnCallNowSchema.parse({
        departmentId: 'dep-1',
        at: start,
      }).at?.toISOString(),
    ).toBe(start)
  })
})
