import { describe, expect, it } from 'vitest'
import {
  addBusinessMinutes,
  businessMinutesBetween,
  computeSlaState,
  parseSdCalendar,
  SD_CALENDAR_24X7,
  type SdCalendar,
  type SdSlaTicketInput,
  startOfSdLocalDay,
} from '@/src/lib/servicedesk/sla'

const WEEK = [
  ['08:00', '12:00'],
  ['13:00', '18:00'],
] as [string, string][]

/** 8×5 em São Paulo (UTC−3, sem horário de verão), almoço 12–13h. */
const BR: SdCalendar = {
  timezone: 'America/Sao_Paulo',
  schedule: { mon: WEEK, tue: WEEK, wed: WEEK, thu: WEEK, fri: WEEK },
  holidays: [{ date: '2026-10-12', name: 'Nossa Senhora Aparecida' }],
  is24x7: false,
}

const iso = (d: Date) => d.toISOString()
const at = (s: string) => new Date(s)

describe('addBusinessMinutes', () => {
  it('adds inside the same window', () => {
    // seg 21/09 09:00 BRT = 12:00Z
    expect(iso(addBusinessMinutes(at('2026-09-21T12:00:00Z'), 60, BR))).toBe(
      '2026-09-21T13:00:00.000Z',
    )
  })

  it('skips the lunch interval', () => {
    expect(iso(addBusinessMinutes(at('2026-09-21T12:00:00Z'), 240, BR))).toBe(
      '2026-09-21T17:00:00.000Z',
    )
  })

  it('starting inside the interval waits for the next window', () => {
    // 12:30 BRT + 30 → 13:30 BRT
    expect(iso(addBusinessMinutes(at('2026-09-21T15:30:00Z'), 30, BR))).toBe(
      '2026-09-21T16:30:00.000Z',
    )
  })

  it('starting before opening begins at 08:00', () => {
    // 06:00 BRT
    expect(iso(addBusinessMinutes(at('2026-09-21T09:00:00Z'), 30, BR))).toBe(
      '2026-09-21T11:30:00.000Z',
    )
  })

  it('rolls over the weekend', () => {
    // sex 25/09 17:00 BRT + 120 → seg 28/09 09:00 BRT
    expect(iso(addBusinessMinutes(at('2026-09-25T20:00:00Z'), 120, BR))).toBe(
      '2026-09-28T12:00:00.000Z',
    )
  })

  it('a Saturday start begins on Monday', () => {
    expect(iso(addBusinessMinutes(at('2026-09-26T15:00:00Z'), 10, BR))).toBe(
      '2026-09-28T11:10:00.000Z',
    )
  })

  it('skips holidays', () => {
    // sex 09/10 17:30 BRT + 60 → 30 na sexta, seg 12/10 feriado, ter 08:30
    expect(iso(addBusinessMinutes(at('2026-10-09T20:30:00Z'), 60, BR))).toBe(
      '2026-10-13T11:30:00.000Z',
    )
  })

  it('handles a start after the local midnight but before UTC midnight', () => {
    // 22:30 BRT de segunda = 01:30Z de terça; próximo expediente ter 08:00
    expect(iso(addBusinessMinutes(at('2026-09-22T01:30:00Z'), 60, BR))).toBe(
      '2026-09-22T12:00:00.000Z',
    )
  })

  it('returns the start for zero or negative minutes', () => {
    const start = at('2026-09-26T15:00:00Z')
    expect(iso(addBusinessMinutes(start, 0, BR))).toBe(iso(start))
    expect(iso(addBusinessMinutes(start, -5, BR))).toBe(iso(start))
  })

  it('supports windows crossing midnight', () => {
    const night: SdCalendar = {
      timezone: 'UTC',
      schedule: Object.fromEntries(
        ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => [
          d,
          [['22:00', '02:00']],
        ]),
      ),
      holidays: [],
      is24x7: false,
    }
    expect(
      iso(addBusinessMinutes(at('2026-09-21T23:00:00Z'), 120, night)),
    ).toBe('2026-09-22T01:00:00.000Z')
    // dentro da janela que começou no dia anterior
    expect(iso(addBusinessMinutes(at('2026-09-22T01:00:00Z'), 30, night))).toBe(
      '2026-09-22T01:30:00.000Z',
    )
    expect(iso(addBusinessMinutes(at('2026-09-22T01:00:00Z'), 90, night))).toBe(
      '2026-09-22T22:30:00.000Z',
    )
  })

  it('treats 24:00 as the end of the day', () => {
    const evening: SdCalendar = {
      timezone: 'UTC',
      schedule: { mon: [['20:00', '24:00']], tue: [['20:00', '24:00']] },
      holidays: [],
      is24x7: false,
    }
    expect(
      iso(addBusinessMinutes(at('2026-09-21T23:30:00Z'), 60, evening)),
    ).toBe('2026-09-22T20:30:00.000Z')
  })

  it('does not double count overlapping windows', () => {
    const overlap: SdCalendar = {
      timezone: 'UTC',
      schedule: {
        mon: [
          ['10:00', '14:00'],
          ['08:00', '12:00'],
          ['09:00', '09:30'],
          ['12:00', '12:00'],
        ],
      },
      holidays: [],
      is24x7: false,
    }
    expect(
      businessMinutesBetween(
        at('2026-09-21T00:00:00Z'),
        at('2026-09-22T00:00:00Z'),
        overlap,
      ),
    ).toBe(360)
    expect(
      iso(addBusinessMinutes(at('2026-09-21T08:00:00Z'), 300, overlap)),
    ).toBe('2026-09-21T13:00:00.000Z')
  })

  it('works in other timezones', () => {
    const tokyo: SdCalendar = { ...BR, timezone: 'Asia/Tokyo', holidays: [] }
    // seg 21/09 09:00 JST = 00:00Z
    expect(
      iso(addBusinessMinutes(at('2026-09-21T00:00:00Z'), 180, tokyo)),
    ).toBe('2026-09-21T03:00:00.000Z')
    // 23:30Z de domingo = 08:30 JST de segunda
    expect(iso(addBusinessMinutes(at('2026-09-20T23:30:00Z'), 30, tokyo))).toBe(
      '2026-09-21T00:00:00.000Z',
    )
  })

  it('uses the wall clock for 24x7 and for empty schedules', () => {
    const start = at('2026-09-26T15:00:00Z')
    expect(iso(addBusinessMinutes(start, 90, SD_CALENDAR_24X7))).toBe(
      '2026-09-26T16:30:00.000Z',
    )
    const empty: SdCalendar = { ...BR, schedule: { mon: [] } }
    expect(iso(addBusinessMinutes(start, 90, empty))).toBe(
      '2026-09-26T16:30:00.000Z',
    )
  })

  it('falls back to the wall clock when no window is found for years', () => {
    const holidays: { date: string }[] = []
    for (let i = -2; i < 366 * 6; i++) {
      holidays.push({
        date: new Date(Date.UTC(2026, 8, 21 + i)).toISOString().slice(0, 10),
      })
    }
    const closed: SdCalendar = { ...BR, holidays }
    const start = at('2026-09-21T12:00:00Z')
    expect(iso(addBusinessMinutes(start, 60, closed))).toBe(
      '2026-09-21T13:00:00.000Z',
    )
  })
})

describe('businessMinutesBetween', () => {
  it('counts only business minutes', () => {
    // sex 17:00 BRT → seg 09:00 BRT = 60 + 60
    expect(
      businessMinutesBetween(
        at('2026-09-25T20:00:00Z'),
        at('2026-09-28T12:00:00Z'),
        BR,
      ),
    ).toBe(120)
  })

  it('counts a full business day as 540 minutes', () => {
    expect(
      businessMinutesBetween(
        at('2026-09-21T03:00:00Z'),
        at('2026-09-22T03:00:00Z'),
        BR,
      ),
    ).toBe(540)
  })

  it('returns zero when b <= a', () => {
    const a = at('2026-09-21T12:00:00Z')
    expect(businessMinutesBetween(a, a, BR)).toBe(0)
    expect(businessMinutesBetween(a, at('2026-09-21T11:00:00Z'), BR)).toBe(0)
  })

  it('returns zero across a closed period', () => {
    expect(
      businessMinutesBetween(
        at('2026-09-26T12:00:00Z'),
        at('2026-09-27T12:00:00Z'),
        BR,
      ),
    ).toBe(0)
  })

  it('uses the wall clock for 24x7', () => {
    expect(
      businessMinutesBetween(
        at('2026-09-26T12:00:00Z'),
        at('2026-09-26T13:30:59Z'),
        SD_CALENDAR_24X7,
      ),
    ).toBe(90)
  })

  it('is the inverse of addBusinessMinutes', () => {
    const start = at('2026-10-09T19:12:00Z')
    const due = addBusinessMinutes(start, 1234, BR)
    expect(businessMinutesBetween(start, due, BR)).toBe(1234)
  })
})

describe('startOfSdLocalDay', () => {
  it('returns the local midnight as an UTC instant', () => {
    // 01:30Z de terça = 22:30 BRT de segunda
    expect(
      iso(startOfSdLocalDay(at('2026-09-22T01:30:00Z'), 'America/Sao_Paulo')),
    ).toBe('2026-09-21T03:00:00.000Z')
    expect(iso(startOfSdLocalDay(at('2026-09-22T01:30:00Z'), 'UTC'))).toBe(
      '2026-09-22T00:00:00.000Z',
    )
  })
})

describe('parseSdCalendar', () => {
  it('returns 24x7 for null', () => {
    expect(parseSdCalendar(null)).toBe(SD_CALENDAR_24X7)
  })

  it('drops malformed ranges and holidays and validates the timezone', () => {
    const cal = parseSdCalendar({
      timezone: 'Mars/Olympus',
      schedule: {
        mon: [
          ['08:00', '12:00'],
          ['8:00', '12:00'],
          ['10:00'],
          'x',
          ['24:30', '25:00'],
        ],
        tue: 'nope',
        fri: [[8, 12]],
      },
      holidays: [
        { date: '2026-12-25', name: 'Natal' },
        { name: 'sem data' },
        null,
        3,
      ],
      is24x7: null,
    })
    expect(cal).toEqual({
      timezone: 'UTC',
      schedule: { mon: [['08:00', '12:00']], fri: [] },
      holidays: [{ date: '2026-12-25', name: 'Natal' }],
      is24x7: false,
    })
  })

  it('keeps valid data and tolerates a missing schedule', () => {
    expect(
      parseSdCalendar({
        timezone: 'America/Sao_Paulo',
        schedule: null,
        holidays: 'x',
        is24x7: true,
      }),
    ).toEqual({
      timezone: 'America/Sao_Paulo',
      schedule: {},
      holidays: [],
      is24x7: true,
    })
    expect(parseSdCalendar({}).timezone).toBe('UTC')
  })
})

function ticket(overrides: Partial<SdSlaTicketInput> = {}): SdSlaTicketInput {
  return {
    createdAt: at('2026-09-21T12:00:00Z'),
    firstResponseDueAt: at('2026-09-21T13:00:00Z'),
    resolutionDueAt: at('2026-09-21T22:00:00Z'),
    firstRespondedAt: null,
    resolvedAt: null,
    slaPausedAt: null,
    slaPausedMinutes: 0,
    firstResponseBreached: false,
    resolutionBreached: false,
    ...overrides,
  }
}

describe('computeSlaState', () => {
  it('returns none without due dates', () => {
    const state = computeSlaState(
      ticket({ firstResponseDueAt: null, resolutionDueAt: null }),
      at('2026-09-21T12:30:00Z'),
    )
    expect(state.firstResponse).toEqual({
      dueAt: null,
      remainingMinutes: null,
      percentUsed: null,
      state: 'none',
    })
    expect(state.resolution.state).toBe('none')
  })

  it('computes ok and at_risk on the wall clock', () => {
    const state = computeSlaState(ticket(), at('2026-09-21T12:50:00Z'))
    expect(state.firstResponse).toEqual({
      dueAt: '2026-09-21T13:00:00.000Z',
      remainingMinutes: 10,
      percentUsed: 83,
      state: 'at_risk',
    })
    expect(state.resolution).toMatchObject({
      remainingMinutes: 550,
      percentUsed: 8,
      state: 'ok',
    })
  })

  it('respects a custom at-risk threshold', () => {
    const state = computeSlaState(ticket(), at('2026-09-21T12:50:00Z'), {
      atRiskPercent: 90,
    })
    expect(state.firstResponse.state).toBe('ok')
  })

  it('marks overdue timers as breached with negative remaining', () => {
    const state = computeSlaState(ticket(), at('2026-09-21T13:30:00Z'))
    expect(state.firstResponse).toMatchObject({
      remainingMinutes: -30,
      percentUsed: 150,
      state: 'breached',
    })
  })

  it('honours the breached flag even before the due date', () => {
    const state = computeSlaState(
      ticket({ resolutionBreached: true }),
      at('2026-09-21T12:10:00Z'),
    )
    expect(state.resolution.state).toBe('breached')
  })

  it('reports met and late completions', () => {
    const met = computeSlaState(
      ticket({
        firstRespondedAt: at('2026-09-21T12:30:00Z'),
        resolvedAt: at('2026-09-21T23:00:00Z'),
      }),
      at('2026-09-22T12:00:00Z'),
    )
    expect(met.firstResponse).toEqual({
      dueAt: '2026-09-21T13:00:00.000Z',
      remainingMinutes: null,
      percentUsed: 50,
      state: 'met',
    })
    expect(met.resolution.state).toBe('breached')

    const flagged = computeSlaState(
      ticket({
        firstRespondedAt: at('2026-09-21T12:30:00Z'),
        firstResponseBreached: true,
      }),
      at('2026-09-22T12:00:00Z'),
    )
    expect(flagged.firstResponse.state).toBe('breached')
  })

  it('freezes the clock while paused', () => {
    const state = computeSlaState(
      ticket({ slaPausedAt: at('2026-09-21T12:40:00Z') }),
      at('2026-09-21T20:00:00Z'),
    )
    expect(state.firstResponse).toMatchObject({
      remainingMinutes: 20,
      state: 'paused',
    })
    const overdue = computeSlaState(
      ticket({ slaPausedAt: at('2026-09-21T13:10:00Z') }),
      at('2026-09-21T20:00:00Z'),
    )
    expect(overdue.firstResponse.state).toBe('breached')
  })

  it('discounts paused minutes from the target and uses the calendar', () => {
    // alvo 60 min úteis, 30 min de pausa empurraram o prazo para 10:30 BRT
    const state = computeSlaState(
      ticket({
        createdAt: at('2026-09-21T12:00:00Z'),
        firstResponseDueAt: at('2026-09-21T13:30:00Z'),
        slaPausedMinutes: 30,
      }),
      at('2026-09-21T13:00:00Z'),
      { calendar: BR },
    )
    expect(state.firstResponse).toMatchObject({
      remainingMinutes: 30,
      percentUsed: 50,
      state: 'ok',
    })
  })

  it('never divides by zero for a due date equal to creation', () => {
    const created = at('2026-09-21T12:00:00Z')
    const state = computeSlaState(
      ticket({ createdAt: created, firstResponseDueAt: created }),
      created,
    )
    expect(state.firstResponse).toMatchObject({
      remainingMinutes: 0,
      percentUsed: 100,
      state: 'at_risk',
    })
  })
})
