import { describe, expect, it } from 'vitest'
import {
  isWithinSdBusinessHours,
  parseSdHandoffMinutes,
  resolveSdOnCall,
  type SdOnCallOverrideSpec,
  type SdOnCallRotationKind,
  type SdOnCallScheduleSpec,
  sdOnCallOverridesOverlap,
  sdOnCallPeriodAt,
  sdOnCallPeriodDays,
  sdOnCallRotationOrder,
  sdOnCallTimeline,
  sdOnCallUserAt,
} from '../servicedesk/oncall'
import type { SdCalendar } from '../servicedesk/sla'

/**
 * O rodízio é a peça mais sensível da fatia: tudo aqui é calculado em
 * instantes UTC explícitos, então o teste vale em qualquer fuso de máquina.
 *
 * Escala de referência: `America/Sao_Paulo` (UTC-3 o ano inteiro), virada às
 * 09:00, começando na segunda 2026-10-05 (09:00 local = 12:00Z).
 */

const SP = 'America/Sao_Paulo'

function layer(
  id: string,
  level: number,
  userIds: string[],
  name = `Camada ${level}`,
) {
  return {
    id,
    name,
    level,
    participants: userIds.map((userId, position) => ({ userId, position })),
  }
}

function schedule(
  overrides: Partial<SdOnCallScheduleSpec> = {},
): SdOnCallScheduleSpec {
  return {
    id: 'sch-1',
    name: 'Plantão de redes',
    departmentId: 'dep-1',
    timezone: SP,
    rotation: 'WEEKLY',
    rotationStart: new Date('2026-10-05T12:00:00.000Z'),
    handoffTime: '09:00',
    active: true,
    calendar: null,
    layers: [layer('l1', 1, ['u1', 'u2', 'u3'])],
    ...overrides,
  }
}

function override(
  patch: Partial<SdOnCallOverrideSpec> = {},
): SdOnCallOverrideSpec {
  return {
    id: 'ov-1',
    layerId: 'l1',
    userId: 'troca',
    startsAt: new Date('2026-10-07T00:00:00.000Z'),
    endsAt: new Date('2026-10-08T00:00:00.000Z'),
    reason: 'Consulta médica',
    ...patch,
  }
}

const businessHours: SdCalendar = {
  timezone: SP,
  schedule: {
    mon: [['08:00', '18:00']],
    tue: [['08:00', '18:00']],
    wed: [['08:00', '18:00']],
    thu: [['08:00', '18:00']],
    fri: [['08:00', '18:00']],
    sat: [],
    sun: [],
  },
  holidays: [{ date: '2026-10-12', name: 'Padroeira' }],
  is24x7: false,
}

describe('parseSdHandoffMinutes', () => {
  it.each([
    ['00:00', 0],
    ['09:00', 540],
    ['13:30', 810],
    ['23:59', 1439],
  ])('converts %s into %i minutes', (value, expected) => {
    expect(parseSdHandoffMinutes(value)).toBe(expected)
  })

  it.each([
    '',
    '9:00',
    '24:00',
    '25:00',
    '09:60',
    'abc',
    null,
    undefined,
  ])('falls back to midnight for %s', (value) => {
    expect(parseSdHandoffMinutes(value)).toBe(0)
  })
})

describe('sdOnCallPeriodDays', () => {
  it('maps each rotation and defaults to a week', () => {
    expect(sdOnCallPeriodDays('DAILY')).toBe(1)
    expect(sdOnCallPeriodDays('WEEKLY')).toBe(7)
    expect(sdOnCallPeriodDays('BIWEEKLY')).toBe(14)
    expect(sdOnCallPeriodDays('HOURLY' as SdOnCallRotationKind)).toBe(7)
  })
})

describe('sdOnCallPeriodAt', () => {
  it('anchors the first period on the handoff of the start day', () => {
    const period = sdOnCallPeriodAt(
      new Date('2026-10-06T00:00:00.000Z'),
      schedule(),
    )
    expect(period.index).toBe(0)
    expect(period.start.toISOString()).toBe('2026-10-05T12:00:00.000Z')
    expect(period.end.toISOString()).toBe('2026-10-12T12:00:00.000Z')
  })

  it('turns over exactly at the handoff, not at midnight', () => {
    const before = sdOnCallPeriodAt(
      new Date('2026-10-12T11:59:59.999Z'),
      schedule(),
    )
    const after = sdOnCallPeriodAt(
      new Date('2026-10-12T12:00:00.000Z'),
      schedule(),
    )
    expect(before.index).toBe(0)
    expect(after.index).toBe(1)
    expect(after.start.toISOString()).toBe('2026-10-12T12:00:00.000Z')
  })

  it('counts backwards before the start of the rotation', () => {
    const period = sdOnCallPeriodAt(
      new Date('2026-10-05T11:00:00.000Z'),
      schedule(),
    )
    expect(period.index).toBe(-1)
    expect(period.start.toISOString()).toBe('2026-09-28T12:00:00.000Z')
    expect(period.end.toISOString()).toBe('2026-10-05T12:00:00.000Z')
  })

  it('handles a handoff in the middle of the day', () => {
    const daily = schedule({ rotation: 'DAILY', handoffTime: '13:30' })
    // 12:00 local do dia seguinte ainda é o período que começou ontem.
    expect(
      sdOnCallPeriodAt(new Date('2026-10-06T15:00:00.000Z'), daily).index,
    ).toBe(0)
    const next = sdOnCallPeriodAt(new Date('2026-10-06T16:30:00.000Z'), daily)
    expect(next.index).toBe(1)
    expect(next.start.toISOString()).toBe('2026-10-06T16:30:00.000Z')
  })

  it('counts biweekly periods in civil days', () => {
    const biweekly = schedule({ rotation: 'BIWEEKLY' })
    expect(
      sdOnCallPeriodAt(new Date('2026-10-19T11:59:59.000Z'), biweekly).index,
    ).toBe(0)
    const second = sdOnCallPeriodAt(
      new Date('2026-10-19T12:00:00.000Z'),
      biweekly,
    )
    expect(second.index).toBe(1)
    expect(second.end.toISOString()).toBe('2026-11-02T12:00:00.000Z')
  })

  it('keeps the local handoff across a daylight saving change', () => {
    // Nova York entra no horário de verão em 15/03/2027 (de madrugada no 14).
    const daily = schedule({
      timezone: 'America/New_York',
      rotation: 'DAILY',
      rotationStart: new Date('2027-03-01T14:00:00.000Z'), // 09:00 EST
    })
    const winter = sdOnCallPeriodAt(new Date('2027-03-13T14:00:00.000Z'), daily)
    expect(winter.index).toBe(12)
    expect(winter.start.toISOString()).toBe('2027-03-13T14:00:00.000Z')

    // Já no horário de verão a virada continua às 09:00 locais (13:00Z).
    const summer = sdOnCallPeriodAt(new Date('2027-03-15T13:00:00.000Z'), daily)
    expect(summer.index).toBe(14)
    expect(summer.start.toISOString()).toBe('2027-03-15T13:00:00.000Z')
    expect(
      sdOnCallPeriodAt(new Date('2027-03-15T12:59:59.000Z'), daily).index,
    ).toBe(13)
  })

  it('falls back to UTC when the timezone is unknown', () => {
    const broken = schedule({ timezone: 'Marte/Olympus', rotation: 'DAILY' })
    const period = sdOnCallPeriodAt(
      new Date('2026-10-06T10:00:00.000Z'),
      broken,
    )
    // Âncora: 09:00 UTC do dia de `rotationStart` (05/10, 12:00Z).
    expect(period.start.toISOString()).toBe('2026-10-06T09:00:00.000Z')
    expect(period.index).toBe(1)
  })
})

describe('sdOnCallRotationOrder', () => {
  it('orders by position and breaks ties by user id', () => {
    expect(
      sdOnCallRotationOrder({
        participants: [
          { userId: 'zoe', position: 1 },
          { userId: 'ana', position: 1 },
          { userId: 'bob', position: 0 },
        ],
      }),
    ).toEqual(['bob', 'ana', 'zoe'])
  })

  it('returns an empty list for a layer with nobody', () => {
    expect(sdOnCallRotationOrder({ participants: [] })).toEqual([])
  })
})

describe('resolveSdOnCall — rodízio', () => {
  it('walks the rotation one participant per period', () => {
    const spec = schedule()
    const at = (iso: string) => resolveSdOnCall(new Date(iso), spec).layers[0]
    expect(at('2026-10-06T00:00:00.000Z').userId).toBe('u1')
    expect(at('2026-10-13T00:00:00.000Z').userId).toBe('u2')
    expect(at('2026-10-20T00:00:00.000Z').userId).toBe('u3')
    // Deu a volta: quarto período volta para o primeiro participante.
    expect(at('2026-10-27T00:00:00.000Z').userId).toBe('u1')
    expect(at('2026-10-06T00:00:00.000Z').source).toBe('rotation')
  })

  it('wraps negative periods before the rotation start', () => {
    const slot = resolveSdOnCall(
      new Date('2026-10-05T11:00:00.000Z'),
      schedule(),
    ).layers[0]
    expect(slot.userId).toBe('u3')
    expect(slot.source).toBe('rotation')
  })

  it('shifts the rotation when a participant leaves the layer', () => {
    const before = resolveSdOnCall(
      new Date('2026-10-13T00:00:00.000Z'),
      schedule(),
    ).layers[0]
    const after = resolveSdOnCall(
      new Date('2026-10-13T00:00:00.000Z'),
      schedule({ layers: [layer('l1', 1, ['u1', 'u3'])] }),
    ).layers[0]
    expect(before.userId).toBe('u2')
    // Com dois participantes o período 1 é o segundo da nova ordem.
    expect(after.userId).toBe('u3')
  })

  it('reports a layer without participants instead of guessing', () => {
    const slot = resolveSdOnCall(
      new Date('2026-10-06T00:00:00.000Z'),
      schedule({ layers: [layer('l1', 1, [])] }),
    ).layers[0]
    expect(slot).toMatchObject({
      userId: null,
      source: 'none',
      overrideId: null,
    })
  })

  it('resolves every layer, ordered by level', () => {
    const resolution = resolveSdOnCall(
      new Date('2026-10-06T00:00:00.000Z'),
      schedule({
        layers: [
          layer('l2', 2, ['boss1', 'boss2']),
          layer('l1', 1, ['u1', 'u2']),
        ],
      }),
    )
    expect(resolution.layers.map((slot) => slot.level)).toEqual([1, 2])
    expect(resolution.layers.map((slot) => slot.userId)).toEqual([
      'u1',
      'boss1',
    ])
    expect(resolution.scheduleName).toBe('Plantão de redes')
    expect(resolution.scheduleId).toBe('sch-1')
  })

  it('exposes the period of the slot', () => {
    const slot = resolveSdOnCall(
      new Date('2026-10-06T00:00:00.000Z'),
      schedule(),
    ).layers[0]
    expect(slot.periodStart.toISOString()).toBe('2026-10-05T12:00:00.000Z')
    expect(slot.periodEnd.toISOString()).toBe('2026-10-12T12:00:00.000Z')
  })
})

describe('resolveSdOnCall — trocas', () => {
  it('lets the override beat the rotation inside its window', () => {
    const spec = schedule()
    const list = [override()]
    expect(
      resolveSdOnCall(new Date('2026-10-07T10:00:00.000Z'), spec, list)
        .layers[0],
    ).toMatchObject({ userId: 'troca', source: 'override', overrideId: 'ov-1' })
    // Fora da janela o rodízio volta.
    expect(
      resolveSdOnCall(new Date('2026-10-06T10:00:00.000Z'), spec, list)
        .layers[0].userId,
    ).toBe('u1')
  })

  it('treats the window as half-open', () => {
    const list = [override()]
    const spec = schedule()
    expect(
      resolveSdOnCall(new Date('2026-10-07T00:00:00.000Z'), spec, list)
        .layers[0].source,
    ).toBe('override')
    expect(
      resolveSdOnCall(new Date('2026-10-08T00:00:00.000Z'), spec, list)
        .layers[0].source,
    ).toBe('rotation')
  })

  it('applies a schedule-wide override to every layer', () => {
    const spec = schedule({
      layers: [layer('l1', 1, ['u1']), layer('l2', 2, ['boss'])],
    })
    const resolution = resolveSdOnCall(
      new Date('2026-10-07T10:00:00.000Z'),
      spec,
      [override({ layerId: null, userId: 'cobre-tudo' })],
    )
    expect(resolution.layers.map((slot) => slot.userId)).toEqual([
      'cobre-tudo',
      'cobre-tudo',
    ])
  })

  it('prefers the layer override over the schedule-wide one', () => {
    const resolution = resolveSdOnCall(
      new Date('2026-10-07T10:00:00.000Z'),
      schedule(),
      [
        override({ id: 'ov-geral', layerId: null, userId: 'geral' }),
        override({ id: 'ov-camada', layerId: 'l1', userId: 'camada' }),
      ],
    )
    expect(resolution.layers[0]).toMatchObject({
      userId: 'camada',
      overrideId: 'ov-camada',
    })
  })

  it('ignores an override of another layer', () => {
    const resolution = resolveSdOnCall(
      new Date('2026-10-07T10:00:00.000Z'),
      schedule(),
      [override({ layerId: 'l9' })],
    )
    expect(resolution.layers[0].userId).toBe('u1')
  })

  it('keeps the latest start whatever the order of the list', () => {
    const slots = [
      ['antiga', 'nova'],
      ['nova', 'antiga'],
    ].map(([first, second]) => {
      const list = [
        override({
          id: first,
          userId: first,
          startsAt: new Date(
            `2026-10-07T0${first === 'nova' ? 6 : 0}:00:00.000Z`,
          ),
        }),
        override({
          id: second,
          userId: second,
          startsAt: new Date(
            `2026-10-07T0${second === 'nova' ? 6 : 0}:00:00.000Z`,
          ),
        }),
      ]
      return resolveSdOnCall(
        new Date('2026-10-07T12:00:00.000Z'),
        schedule(),
        list,
      ).layers[0].overrideId
    })
    expect(slots).toEqual(['nova', 'nova'])
  })

  it('keeps the most recent override when two start inside the window', () => {
    const resolution = resolveSdOnCall(
      new Date('2026-10-07T12:00:00.000Z'),
      schedule(),
      [
        override({ id: 'antiga', userId: 'antiga' }),
        override({
          id: 'nova',
          userId: 'nova',
          startsAt: new Date('2026-10-07T06:00:00.000Z'),
        }),
      ],
    )
    expect(resolution.layers[0].overrideId).toBe('nova')
  })
})

describe('isWithinSdBusinessHours', () => {
  it('detects the business window in the calendar timezone', () => {
    // Segunda 10:00 em São Paulo.
    expect(
      isWithinSdBusinessHours(
        new Date('2026-10-05T13:00:00.000Z'),
        businessHours,
      ),
    ).toBe(true)
    // Segunda 20:00 (depois das 18:00).
    expect(
      isWithinSdBusinessHours(
        new Date('2026-10-05T23:00:00.000Z'),
        businessHours,
      ),
    ).toBe(false)
    // Domingo.
    expect(
      isWithinSdBusinessHours(
        new Date('2026-10-04T13:00:00.000Z'),
        businessHours,
      ),
    ).toBe(false)
    // Feriado em dia útil.
    expect(
      isWithinSdBusinessHours(
        new Date('2026-10-12T13:00:00.000Z'),
        businessHours,
      ),
    ).toBe(false)
  })

  it('treats 24x7 as always inside and an empty calendar as always outside', () => {
    const at = new Date('2026-10-04T03:00:00.000Z')
    expect(
      isWithinSdBusinessHours(at, { ...businessHours, is24x7: true }),
    ).toBe(true)
    expect(
      isWithinSdBusinessHours(at, {
        ...businessHours,
        schedule: {},
        is24x7: false,
      }),
    ).toBe(false)
  })
})

describe('resolveSdOnCall — expediente e escala desligada', () => {
  it('only applies outside the business hours of the calendar', () => {
    const spec = schedule({ calendar: businessHours })
    const inside = resolveSdOnCall(new Date('2026-10-05T13:00:00.000Z'), spec)
    expect(inside).toMatchObject({ offHours: false, applies: false })
    // Mesmo sem valer, a camada mostra quem é o plantonista do período.
    expect(inside.layers[0].userId).toBe('u1')

    const outside = resolveSdOnCall(new Date('2026-10-05T23:00:00.000Z'), spec)
    expect(outside).toMatchObject({ offHours: true, applies: true })
  })

  it('applies around the clock without a calendar', () => {
    const resolution = resolveSdOnCall(
      new Date('2026-10-05T13:00:00.000Z'),
      schedule(),
    )
    expect(resolution).toMatchObject({ offHours: true, applies: true })
  })

  it('never applies while the schedule is off', () => {
    const resolution = resolveSdOnCall(
      new Date('2026-10-05T23:00:00.000Z'),
      schedule({ active: false }),
    )
    expect(resolution).toMatchObject({ offHours: true, applies: false })
  })
})

describe('sdOnCallUserAt', () => {
  it('finds the slot by level', () => {
    const spec = schedule({
      layers: [layer('l1', 1, ['u1']), layer('l2', 2, ['boss'])],
    })
    const at = new Date('2026-10-06T00:00:00.000Z')
    expect(sdOnCallUserAt(at, spec, [], 2)?.userId).toBe('boss')
    expect(sdOnCallUserAt(at, spec, [], 9)).toBeNull()
  })
})

describe('sdOnCallTimeline', () => {
  const from = new Date('2026-10-06T00:00:00.000Z')
  const to = new Date('2026-10-20T00:00:00.000Z')

  it('splits the next two weeks by the rotation handoffs', () => {
    const [timeline] = sdOnCallTimeline(schedule(), [], from, to)
    expect(timeline).toMatchObject({
      layerId: 'l1',
      layerName: 'Camada 1',
      level: 1,
    })
    expect(
      timeline.segments.map((segment) => [
        segment.start.toISOString(),
        segment.end.toISOString(),
        segment.userId,
      ]),
    ).toEqual([
      ['2026-10-06T00:00:00.000Z', '2026-10-12T12:00:00.000Z', 'u1'],
      ['2026-10-12T12:00:00.000Z', '2026-10-19T12:00:00.000Z', 'u2'],
      ['2026-10-19T12:00:00.000Z', '2026-10-20T00:00:00.000Z', 'u3'],
    ])
    expect(timeline.segments.every((s) => s.source === 'rotation')).toBe(true)
  })

  it('carves the override out of the rotation segment', () => {
    const [timeline] = sdOnCallTimeline(schedule(), [override()], from, to)
    expect(
      timeline.segments.map((segment) => [
        segment.start.toISOString(),
        segment.userId,
        segment.source,
      ]),
    ).toEqual([
      ['2026-10-06T00:00:00.000Z', 'u1', 'rotation'],
      ['2026-10-07T00:00:00.000Z', 'troca', 'override'],
      ['2026-10-08T00:00:00.000Z', 'u1', 'rotation'],
      ['2026-10-12T12:00:00.000Z', 'u2', 'rotation'],
      ['2026-10-19T12:00:00.000Z', 'u3', 'rotation'],
    ])
    expect(timeline.segments[1].overrideId).toBe('ov-1')
  })

  it('merges neighbouring periods covered by the same person', () => {
    const [timeline] = sdOnCallTimeline(
      schedule({ layers: [layer('l1', 1, ['solo'])] }),
      [],
      from,
      to,
    )
    expect(timeline.segments).toHaveLength(1)
    expect(timeline.segments[0]).toMatchObject({ userId: 'solo' })
    expect(timeline.segments[0].end.toISOString()).toBe(
      '2026-10-20T00:00:00.000Z',
    )
  })

  it('ignores an override that ends before the window', () => {
    const [timeline] = sdOnCallTimeline(
      schedule(),
      [
        override({
          startsAt: new Date('2026-10-01T00:00:00.000Z'),
          endsAt: new Date('2026-10-02T00:00:00.000Z'),
        }),
      ],
      from,
      to,
    )
    expect(timeline.segments).toHaveLength(3)
  })

  it('builds a line per layer and keeps empty layers', () => {
    const timelines = sdOnCallTimeline(
      schedule({
        layers: [layer('l2', 2, []), layer('l1', 1, ['u1'])],
      }),
      [],
      from,
      to,
    )
    expect(timelines.map((line) => line.level)).toEqual([1, 2])
    expect(timelines[1].segments).toEqual([
      {
        start: from,
        end: to,
        userId: null,
        source: 'none',
        overrideId: null,
      },
    ])
  })

  it('returns no segment for an empty or inverted window', () => {
    expect(sdOnCallTimeline(schedule(), [], to, from)[0].segments).toEqual([])
    expect(sdOnCallTimeline(schedule(), [], from, from)[0].segments).toEqual([])
  })

  it('splits a daily rotation day by day', () => {
    const [timeline] = sdOnCallTimeline(
      schedule({ rotation: 'DAILY' }),
      [],
      new Date('2026-10-06T12:00:00.000Z'),
      new Date('2026-10-09T12:00:00.000Z'),
    )
    expect(timeline.segments).toHaveLength(3)
    expect(timeline.segments.map((segment) => segment.userId)).toEqual([
      'u2',
      'u3',
      'u1',
    ])
  })
})

describe('sdOnCallOverridesOverlap', () => {
  const window = (
    start: string,
    end: string,
    layerId: string | null = 'l1',
  ) => ({
    layerId,
    startsAt: new Date(start),
    endsAt: new Date(end),
  })

  it('catches two overrides disputing the same layer', () => {
    expect(
      sdOnCallOverridesOverlap(
        window('2026-10-07T00:00:00Z', '2026-10-09T00:00:00Z'),
        window('2026-10-08T00:00:00Z', '2026-10-10T00:00:00Z'),
      ),
    ).toBe(true)
  })

  it('lets windows that only touch live together', () => {
    expect(
      sdOnCallOverridesOverlap(
        window('2026-10-07T00:00:00Z', '2026-10-08T00:00:00Z'),
        window('2026-10-08T00:00:00Z', '2026-10-09T00:00:00Z'),
      ),
    ).toBe(false)
  })

  it('ignores overrides of different layers', () => {
    expect(
      sdOnCallOverridesOverlap(
        window('2026-10-07T00:00:00Z', '2026-10-09T00:00:00Z', 'l1'),
        window('2026-10-07T00:00:00Z', '2026-10-09T00:00:00Z', 'l2'),
      ),
    ).toBe(false)
  })

  it('treats a schedule-wide override as colliding with any layer', () => {
    expect(
      sdOnCallOverridesOverlap(
        window('2026-10-07T00:00:00Z', '2026-10-09T00:00:00Z', null),
        window('2026-10-08T00:00:00Z', '2026-10-09T00:00:00Z', 'l2'),
      ),
    ).toBe(true)
    expect(
      sdOnCallOverridesOverlap(
        window('2026-10-07T00:00:00Z', '2026-10-09T00:00:00Z', 'l2'),
        window('2026-10-08T00:00:00Z', '2026-10-09T00:00:00Z', null),
      ),
    ).toBe(true)
  })

  it('accepts a window without an explicit layer field', () => {
    expect(
      sdOnCallOverridesOverlap(
        {
          startsAt: new Date('2026-10-07T00:00:00Z'),
          endsAt: new Date('2026-10-09T00:00:00Z'),
        },
        window('2026-10-08T00:00:00Z', '2026-10-10T00:00:00Z'),
      ),
    ).toBe(true)
  })
})
