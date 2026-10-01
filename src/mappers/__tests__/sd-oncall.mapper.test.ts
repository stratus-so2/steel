import { describe, expect, it } from 'vitest'
import {
  createFakeSdOnCallOverride,
  createFakeSdOnCallSchedule,
} from '@/src/__tests__/factories/sd-oncall.factory'
import { resolveSdOnCall, sdOnCallTimeline } from '@/src/lib/servicedesk/oncall'
import {
  toSdOnCallNowDTO,
  toSdOnCallOverrideDTO,
  toSdOnCallOverrideSpecs,
  toSdOnCallScheduleDTO,
  toSdOnCallSpec,
  toSdOnCallTimelineDTO,
} from '../sd-oncall.mapper'

const AT = new Date('2026-10-06T00:00:00.000Z')

describe('toSdOnCallScheduleDTO', () => {
  it('exposes the schedule with its layers and participants', () => {
    const dto = toSdOnCallScheduleDTO(createFakeSdOnCallSchedule())
    expect(dto).toMatchObject({
      name: 'Plantão de redes',
      timezone: 'America/Sao_Paulo',
      rotation: 'WEEKLY',
      handoffTime: '09:00',
      active: true,
      department: { id: 'dep-1', name: 'Redes' },
      calendar: null,
    })
    expect(dto.rotationStart).toBe('2026-10-05T12:00:00.000Z')
    expect(dto.layers[0].participants.map((p) => p.user.name)).toEqual([
      'Agente u1',
      'Agente u2',
    ])
  })

  it('keeps the schedule without department and with a calendar', () => {
    const dto = toSdOnCallScheduleDTO(
      createFakeSdOnCallSchedule({
        department: null,
        departmentId: null,
        calendarId: 'cal-1',
        calendar: {
          id: 'cal-1',
          name: 'Comercial',
          timezone: 'America/Sao_Paulo',
          schedule: { mon: [['08:00', '18:00']] },
          holidays: [],
          is24x7: false,
        },
      }),
    )
    expect(dto.department).toBeNull()
    expect(dto.calendar).toEqual({ id: 'cal-1', name: 'Comercial' })
  })
})

describe('toSdOnCallOverrideDTO', () => {
  it('names the schedule and the person covering', () => {
    expect(toSdOnCallOverrideDTO(createFakeSdOnCallOverride())).toMatchObject({
      scheduleName: 'Plantão de redes',
      layerId: 'layer-1',
      reason: 'Consulta médica',
      user: { id: 'u3', name: 'Agente u3' },
      startsAt: '2026-10-07T00:00:00.000Z',
      endsAt: '2026-10-08T00:00:00.000Z',
    })
  })
})

describe('toSdOnCallSpec', () => {
  it('normalizes the calendar for the pure lib', () => {
    const spec = toSdOnCallSpec(
      createFakeSdOnCallSchedule({
        calendarId: 'cal-1',
        calendar: {
          id: 'cal-1',
          name: 'Comercial',
          timezone: 'America/Sao_Paulo',
          schedule: { mon: [['08:00', '18:00']], lixo: 'x' },
          holidays: [{ date: '2026-10-12' }],
          is24x7: false,
        },
      }),
    )
    expect(spec.calendar).toMatchObject({
      timezone: 'America/Sao_Paulo',
      is24x7: false,
      holidays: [{ date: '2026-10-12' }],
    })
    expect(spec.calendar?.schedule.mon).toEqual([['08:00', '18:00']])
    expect(spec.layers[0].participants).toEqual([
      { userId: 'u1', position: 0 },
      { userId: 'u2', position: 1 },
    ])
  })

  it('leaves the calendar out when the schedule has none', () => {
    expect(toSdOnCallSpec(createFakeSdOnCallSchedule()).calendar).toBeNull()
  })
})

describe('toSdOnCallOverrideSpecs', () => {
  it('keeps only what the rotation needs', () => {
    expect(
      toSdOnCallOverrideSpecs([createFakeSdOnCallOverride({ id: 'ov-1' })]),
    ).toEqual([
      {
        id: 'ov-1',
        layerId: 'layer-1',
        userId: 'u3',
        startsAt: new Date('2026-10-07T00:00:00.000Z'),
        endsAt: new Date('2026-10-08T00:00:00.000Z'),
        reason: 'Consulta médica',
      },
    ])
  })
})

describe('toSdOnCallNowDTO', () => {
  it('attaches the user of each layer', () => {
    const schedule = createFakeSdOnCallSchedule()
    const resolution = resolveSdOnCall(AT, toSdOnCallSpec(schedule))
    const dto = toSdOnCallNowDTO(schedule, resolution)
    expect(dto).toMatchObject({
      scheduleName: 'Plantão de redes',
      offHours: true,
      applies: true,
      at: AT.toISOString(),
    })
    expect(dto.layers[0]).toMatchObject({
      level: 1,
      userId: 'u1',
      source: 'rotation',
      overrideId: null,
    })
    expect(dto.layers[0].user?.name).toBe('Agente u1')
    expect(dto.layers[0].periodStart).toBe('2026-10-05T12:00:00.000Z')
  })

  it('resolves the user of an override that is not in the layer', () => {
    const schedule = createFakeSdOnCallSchedule()
    const override = createFakeSdOnCallOverride({ layerId: 'layer-1' })
    const resolution = resolveSdOnCall(
      new Date('2026-10-07T10:00:00.000Z'),
      toSdOnCallSpec(schedule),
      toSdOnCallOverrideSpecs([override]),
    )
    const dto = toSdOnCallNowDTO(schedule, resolution, [override])
    expect(dto.layers[0]).toMatchObject({ userId: 'u3', source: 'override' })
    expect(dto.layers[0].user?.email).toBe('u3@steel.test')
  })

  it('leaves the user null on an empty layer and on an unknown id', () => {
    const empty = createFakeSdOnCallSchedule({
      layers: [
        {
          id: 'layer-1',
          scheduleId: 'sch-1',
          name: 'Primeira chamada',
          level: 1,
          participants: [],
        },
      ],
    })
    const dto = toSdOnCallNowDTO(
      empty,
      resolveSdOnCall(AT, toSdOnCallSpec(empty)),
    )
    expect(dto.layers[0]).toMatchObject({ userId: null, user: null })

    // Plantonista que já saiu do cadastro: o id fica, o usuário não.
    const stale = createFakeSdOnCallSchedule()
    const resolution = resolveSdOnCall(AT, toSdOnCallSpec(stale))
    const orphan = toSdOnCallNowDTO(
      { ...stale, layers: [{ ...stale.layers[0], participants: [] }] },
      resolution,
    )
    expect(orphan.layers[0]).toMatchObject({ userId: 'u1', user: null })
  })

  it('reports no department', () => {
    const schedule = createFakeSdOnCallSchedule({ department: null })
    expect(
      toSdOnCallNowDTO(schedule, resolveSdOnCall(AT, toSdOnCallSpec(schedule)))
        .department,
    ).toBeNull()
  })
})

describe('toSdOnCallTimelineDTO', () => {
  it('serializes the segments with their users', () => {
    const schedule = createFakeSdOnCallSchedule()
    const from = AT
    const to = new Date('2026-10-20T00:00:00.000Z')
    const dto = toSdOnCallTimelineDTO(
      schedule,
      sdOnCallTimeline(toSdOnCallSpec(schedule), [], from, to),
      { from, to },
    )
    expect(dto).toMatchObject({
      scheduleName: 'Plantão de redes',
      timezone: 'America/Sao_Paulo',
      from: from.toISOString(),
      to: to.toISOString(),
    })
    expect(
      dto.layers[0].segments.map((segment) => [
        segment.start,
        segment.userId,
        segment.user?.name,
      ]),
    ).toEqual([
      ['2026-10-06T00:00:00.000Z', 'u1', 'Agente u1'],
      ['2026-10-12T12:00:00.000Z', 'u2', 'Agente u2'],
      ['2026-10-19T12:00:00.000Z', 'u1', 'Agente u1'],
    ])
  })

  it('keeps the id of a plantonista who left the records', () => {
    const schedule = createFakeSdOnCallSchedule()
    const from = AT
    const to = new Date('2026-10-08T00:00:00.000Z')
    const timeline = sdOnCallTimeline(toSdOnCallSpec(schedule), [], from, to)
    const dto = toSdOnCallTimelineDTO(
      { ...schedule, layers: [{ ...schedule.layers[0], participants: [] }] },
      timeline,
      { from, to },
    )
    expect(dto.layers[0].segments[0]).toMatchObject({
      userId: 'u1',
      user: null,
    })
  })

  it('serializes an empty layer without a user', () => {
    const schedule = createFakeSdOnCallSchedule({
      layers: [
        {
          id: 'layer-1',
          scheduleId: 'sch-1',
          name: 'Primeira chamada',
          level: 1,
          participants: [],
        },
      ],
    })
    const from = AT
    const to = new Date('2026-10-08T00:00:00.000Z')
    const dto = toSdOnCallTimelineDTO(
      schedule,
      sdOnCallTimeline(toSdOnCallSpec(schedule), [], from, to),
      { from, to },
    )
    expect(dto.layers[0].segments[0]).toMatchObject({
      userId: null,
      user: null,
      source: 'none',
    })
  })
})
