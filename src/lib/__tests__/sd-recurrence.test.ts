import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  describeSdRecurrence,
  firstSdOccurrence,
  isValidSdTimeZone,
  nextSdOccurrence,
  nextSdOccurrences,
  SD_WEEKDAY_LABELS,
  type SdRecurrenceSchedule,
  sdRecurrenceProblem,
} from '@/src/lib/servicedesk/recurrence'

/**
 * Agenda dos chamados recorrentes. O tempo fica congelado (`setSystemTime`)
 * e todos os instantes esperados são escritos em UTC: São Paulo é UTC−3 sem
 * horário de verão desde 2019, então 08:00 local = 11:00Z.
 */

const at = (iso: string) => new Date(iso)

function schedule(
  overrides: Partial<SdRecurrenceSchedule> = {},
): SdRecurrenceSchedule {
  return {
    frequency: 'MONTHLY',
    interval: 1,
    byWeekday: [],
    byMonthday: 5,
    atTime: '08:00',
    timezone: 'America/Sao_Paulo',
    startsAt: at('2026-10-01T03:00:00.000Z'),
    endsAt: null,
    leadTimeMinutes: 0,
    ...overrides,
  }
}

const isoOf = (occurrences: { scheduledFor: Date }[]) =>
  occurrences.map((o) => o.scheduledFor.toISOString())

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(at('2026-10-01T12:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isValidSdTimeZone', () => {
  it('accepts an IANA zone and refuses junk', () => {
    expect(isValidSdTimeZone('America/Sao_Paulo')).toBe(true)
    expect(isValidSdTimeZone('UTC')).toBe(true)
    expect(isValidSdTimeZone('Mars/Olympus')).toBe(false)
  })
})

describe('nextSdOccurrence — DAILY', () => {
  it('uses the rule timezone, not the server one', () => {
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      atTime: '08:00',
    })
    const next = nextSdOccurrence(daily, at('2026-10-01T12:00:00.000Z'))
    // 08:00 em São Paulo (UTC−3) = 11:00Z do dia seguinte.
    expect(next?.scheduledFor.toISOString()).toBe('2026-10-02T11:00:00.000Z')
  })

  it('returns the same day when the time has not passed yet', () => {
    const daily = schedule({ frequency: 'DAILY', byMonthday: null })
    const next = nextSdOccurrence(daily, at('2026-10-01T09:00:00.000Z'))
    expect(next?.scheduledFor.toISOString()).toBe('2026-10-01T11:00:00.000Z')
  })

  it('honours the interval counted from startsAt', () => {
    const daily = schedule({
      frequency: 'DAILY',
      interval: 3,
      byMonthday: null,
      startsAt: at('2026-10-01T03:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(daily, at('2026-10-01T00:00:00Z'), 3)),
    ).toEqual([
      '2026-10-01T11:00:00.000Z',
      '2026-10-04T11:00:00.000Z',
      '2026-10-07T11:00:00.000Z',
    ])
  })

  it('filters by weekday when byWeekday is set', () => {
    // 2026-10-01 é quinta; só segunda (1) e quarta (3).
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      byWeekday: [1, 3],
    })
    expect(
      isoOf(nextSdOccurrences(daily, at('2026-10-01T00:00:00Z'), 3)),
    ).toEqual([
      '2026-10-05T11:00:00.000Z',
      '2026-10-07T11:00:00.000Z',
      '2026-10-12T11:00:00.000Z',
    ])
  })

  it('subtracts the lead time to get runAt without moving the occurrence', () => {
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      leadTimeMinutes: 90,
    })
    const next = nextSdOccurrence(daily, at('2026-10-01T00:00:00.000Z'))
    expect(next?.scheduledFor.toISOString()).toBe('2026-10-01T11:00:00.000Z')
    expect(next?.runAt.toISOString()).toBe('2026-10-01T09:30:00.000Z')
  })
})

describe('nextSdOccurrence — WEEKLY', () => {
  it('without byWeekday repeats the weekday of startsAt', () => {
    // 2026-10-01 é quinta-feira.
    const weekly = schedule({ frequency: 'WEEKLY', byMonthday: null })
    expect(
      isoOf(nextSdOccurrences(weekly, at('2026-10-01T00:00:00Z'), 2)),
    ).toEqual(['2026-10-01T11:00:00.000Z', '2026-10-08T11:00:00.000Z'])
  })

  it('takes every weekday listed, in chronological order', () => {
    const weekly = schedule({
      frequency: 'WEEKLY',
      byMonthday: null,
      byWeekday: [1, 5],
    })
    expect(
      isoOf(nextSdOccurrences(weekly, at('2026-10-01T00:00:00Z'), 3)),
    ).toEqual([
      '2026-10-02T11:00:00.000Z',
      '2026-10-05T11:00:00.000Z',
      '2026-10-09T11:00:00.000Z',
    ])
  })

  it('skips the odd weeks when the interval is 2 (week starts on sunday)', () => {
    const weekly = schedule({
      frequency: 'WEEKLY',
      interval: 2,
      byMonthday: null,
      byWeekday: [4],
    })
    expect(
      isoOf(nextSdOccurrences(weekly, at('2026-10-01T00:00:00Z'), 3)),
    ).toEqual([
      '2026-10-01T11:00:00.000Z',
      '2026-10-15T11:00:00.000Z',
      '2026-10-29T11:00:00.000Z',
    ])
  })

  it('a weekday before startsAt in the same week waits for the next cycle', () => {
    // startsAt quinta 01/10; segunda (1) só na semana seguinte.
    const weekly = schedule({
      frequency: 'WEEKLY',
      byMonthday: null,
      byWeekday: [1],
    })
    expect(
      nextSdOccurrence(
        weekly,
        at('2026-09-30T00:00:00Z'),
      )?.scheduledFor.toISOString(),
    ).toBe('2026-10-05T11:00:00.000Z')
  })
})

describe('nextSdOccurrence — MONTHLY', () => {
  it('repeats on the chosen day of the month', () => {
    const monthly = schedule({ byMonthday: 10 })
    expect(
      isoOf(nextSdOccurrences(monthly, at('2026-10-01T00:00:00Z'), 3)),
    ).toEqual([
      '2026-10-10T11:00:00.000Z',
      '2026-11-10T11:00:00.000Z',
      '2026-12-10T11:00:00.000Z',
    ])
  })

  it('without byMonthday repeats the day of startsAt', () => {
    const monthly = schedule({
      byMonthday: null,
      startsAt: at('2026-10-18T03:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(monthly, at('2026-10-01T00:00:00Z'), 2)),
    ).toEqual(['2026-10-18T11:00:00.000Z', '2026-11-18T11:00:00.000Z'])
  })

  it('clamps day 31 to the last day of short months', () => {
    const monthly = schedule({
      byMonthday: 31,
      startsAt: at('2026-01-01T03:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(monthly, at('2026-01-01T00:00:00Z'), 5)),
    ).toEqual([
      '2026-01-31T11:00:00.000Z',
      '2026-02-28T11:00:00.000Z',
      '2026-03-31T11:00:00.000Z',
      '2026-04-30T11:00:00.000Z',
      '2026-05-31T11:00:00.000Z',
    ])
  })

  it('clamps day 30 to 29 of february in a leap year', () => {
    const monthly = schedule({
      byMonthday: 30,
      startsAt: at('2028-02-01T03:00:00.000Z'),
    })
    expect(
      nextSdOccurrence(
        monthly,
        at('2028-02-01T00:00:00Z'),
      )?.scheduledFor.toISOString(),
    ).toBe('2028-02-29T11:00:00.000Z')
  })

  it('crosses the turn of the year', () => {
    const monthly = schedule({ byMonthday: 5 })
    expect(
      nextSdOccurrence(
        monthly,
        at('2026-12-20T00:00:00Z'),
      )?.scheduledFor.toISOString(),
    ).toBe('2027-01-05T11:00:00.000Z')
  })

  it('honours a quarterly interval', () => {
    const monthly = schedule({
      interval: 3,
      byMonthday: 1,
      startsAt: at('2026-10-01T03:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(monthly, at('2026-10-02T00:00:00Z'), 2)),
    ).toEqual(['2027-01-01T11:00:00.000Z', '2027-04-01T11:00:00.000Z'])
  })
})

describe('nextSdOccurrence — YEARLY', () => {
  it('repeats on the month and day of startsAt', () => {
    const yearly = schedule({
      frequency: 'YEARLY',
      byMonthday: null,
      startsAt: at('2026-07-15T03:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(yearly, at('2026-01-01T00:00:00Z'), 2)),
    ).toEqual(['2026-07-15T11:00:00.000Z', '2027-07-15T11:00:00.000Z'])
  })

  it('clamps 29 of february to 28 outside leap years', () => {
    const yearly = schedule({
      frequency: 'YEARLY',
      byMonthday: 29,
      startsAt: at('2028-02-29T03:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(yearly, at('2028-01-01T00:00:00Z'), 2)),
    ).toEqual(['2028-02-29T11:00:00.000Z', '2029-02-28T11:00:00.000Z'])
  })

  it('honours the interval in years', () => {
    const yearly = schedule({
      frequency: 'YEARLY',
      interval: 2,
      byMonthday: null,
      startsAt: at('2026-03-10T03:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(yearly, at('2026-03-11T00:00:00Z'), 2)),
    ).toEqual(['2028-03-10T11:00:00.000Z', '2030-03-10T11:00:00.000Z'])
  })
})

describe('vigência', () => {
  it('never returns an occurrence before startsAt', () => {
    const monthly = schedule({
      byMonthday: 5,
      startsAt: at('2027-01-01T03:00:00.000Z'),
    })
    expect(
      nextSdOccurrence(
        monthly,
        at('2026-10-01T00:00:00Z'),
      )?.scheduledFor.toISOString(),
    ).toBe('2027-01-05T11:00:00.000Z')
  })

  it('stops at endsAt', () => {
    const monthly = schedule({
      byMonthday: 5,
      endsAt: at('2026-11-30T00:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(monthly, at('2026-10-01T00:00:00Z'), 5)),
    ).toEqual(['2026-10-05T11:00:00.000Z', '2026-11-05T11:00:00.000Z'])
    expect(nextSdOccurrence(monthly, at('2026-11-06T00:00:00Z'))).toBeNull()
  })
})

describe('horário de verão', () => {
  it('a local time that does not exist lands right after the jump (São Paulo 2017)', () => {
    // 15/10/2017: o relógio pulou de 00:00 para 01:00 em São Paulo.
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      atTime: '00:30',
      startsAt: at('2017-10-01T03:00:00.000Z'),
    })
    const next = nextSdOccurrence(daily, at('2017-10-14T12:00:00.000Z'))
    // 00:30 inexistente → 01:30 BRST = 03:30Z (UTC−2 no verão).
    expect(next?.scheduledFor.toISOString()).toBe('2017-10-15T03:30:00.000Z')
  })

  it('a local time that does not exist lands right after the jump (New York)', () => {
    // 08/03/2026: 02:00 → 03:00 em Nova York.
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      atTime: '02:30',
      timezone: 'America/New_York',
      startsAt: at('2026-03-01T05:00:00.000Z'),
    })
    const next = nextSdOccurrence(daily, at('2026-03-07T12:00:00.000Z'))
    expect(next?.scheduledFor.toISOString()).toBe('2026-03-08T07:30:00.000Z')
  })

  it('keeps the local time on the day the clock jumps forward (New York)', () => {
    // 08/03/2026: 03:30 existe (já em EDT, UTC−4).
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      atTime: '03:30',
      timezone: 'America/New_York',
      startsAt: at('2026-03-01T05:00:00.000Z'),
    })
    expect(
      nextSdOccurrence(
        daily,
        at('2026-03-07T12:00:00Z'),
      )?.scheduledFor.toISOString(),
    ).toBe('2026-03-08T07:30:00.000Z')
  })

  it('keeps the local time across the end of DST (New York)', () => {
    // 01/11/2026 o relógio volta: 09:00 local vira UTC−5.
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      atTime: '09:00',
      timezone: 'America/New_York',
      startsAt: at('2026-10-30T04:00:00.000Z'),
    })
    expect(
      isoOf(nextSdOccurrences(daily, at('2026-10-30T00:00:00Z'), 4)),
    ).toEqual([
      '2026-10-30T13:00:00.000Z',
      '2026-10-31T13:00:00.000Z',
      '2026-11-01T14:00:00.000Z',
      '2026-11-02T14:00:00.000Z',
    ])
  })

  it('an ambiguous local time takes the first pass (New York)', () => {
    // 01/11/2026 01:30 acontece duas vezes; vale a primeira (UTC−4).
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      atTime: '01:30',
      timezone: 'America/New_York',
      startsAt: at('2026-11-01T04:00:00.000Z'),
    })
    expect(
      nextSdOccurrence(
        daily,
        at('2026-11-01T00:00:00Z'),
      )?.scheduledFor.toISOString(),
    ).toBe('2026-11-01T05:30:00.000Z')
  })

  it('works in a zone east of UTC', () => {
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      atTime: '08:00',
      timezone: 'Asia/Tokyo',
      // 01/10 00:00 em Tóquio.
      startsAt: at('2026-09-30T15:00:00.000Z'),
    })
    // 08:00 em Tóquio (UTC+9) = 23:00Z do dia anterior.
    expect(
      nextSdOccurrence(
        daily,
        at('2026-09-30T00:00:00Z'),
      )?.scheduledFor.toISOString(),
    ).toBe('2026-09-30T23:00:00.000Z')
  })
})

describe('firstSdOccurrence', () => {
  it('schedules from now for a rule created already overdue (no backfill)', () => {
    const daily = schedule({
      frequency: 'DAILY',
      byMonthday: null,
      startsAt: at('2026-01-01T03:00:00.000Z'),
    })
    const first = firstSdOccurrence(daily, new Date())
    expect(first?.scheduledFor.toISOString()).toBe('2026-10-02T11:00:00.000Z')
  })

  it('schedules the very first occurrence of a rule that starts in the future', () => {
    const monthly = schedule({
      byMonthday: 5,
      startsAt: at('2027-03-05T11:00:00.000Z'),
    })
    expect(
      firstSdOccurrence(monthly, new Date())?.scheduledFor.toISOString(),
    ).toBe('2027-03-05T11:00:00.000Z')
  })

  it('returns null when the validity window is already over', () => {
    const monthly = schedule({
      byMonthday: 5,
      startsAt: at('2026-01-01T03:00:00.000Z'),
      endsAt: at('2026-02-01T00:00:00.000Z'),
    })
    expect(firstSdOccurrence(monthly, new Date())).toBeNull()
  })
})

describe('nextSdOccurrences — guardas', () => {
  it.each([
    ['limit zero', { limit: 0 }],
    ['invalid time', { overrides: { atTime: '99:99' } }],
    ['unknown timezone', { overrides: { timezone: 'Mars/Olympus' } }],
    ['interval below one', { overrides: { interval: 0 } }],
    ['fractional interval', { overrides: { interval: 1.5 } }],
    ['invalid startsAt', { overrides: { startsAt: new Date('nope') } }],
  ])('returns nothing for %s', (_label, input) => {
    const { limit = 3, overrides = {} } = input as {
      limit?: number
      overrides?: Partial<SdRecurrenceSchedule>
    }
    expect(
      nextSdOccurrences(schedule(overrides), at('2026-10-01T00:00:00Z'), limit),
    ).toEqual([])
  })

  it('returns nothing for an invalid `after`', () => {
    expect(nextSdOccurrences(schedule(), new Date('nope'), 3)).toEqual([])
  })

  it('gives up instead of scanning forever when nothing ever matches', () => {
    const impossible = schedule({
      frequency: 'YEARLY',
      interval: 366,
      byMonthday: 1,
      startsAt: at('2026-01-01T03:00:00.000Z'),
    })
    // A primeira repetição depois de 2026 só cairia em 2392.
    expect(nextSdOccurrence(impossible, at('2026-06-01T00:00:00Z'))).toBeNull()
  })
})

describe('sdRecurrenceProblem', () => {
  it('accepts a valid schedule', () => {
    expect(sdRecurrenceProblem(schedule())).toBeNull()
  })

  it.each([
    [
      'frequência inválida',
      { frequency: 'HOURLY' as unknown as SdRecurrenceSchedule['frequency'] },
      'Frequência inválida',
    ],
    ['intervalo zero', { interval: 0 }, 'O intervalo deve ser de pelo menos 1'],
    [
      'horário fora do formato',
      { atTime: '24:00' },
      'Horário inválido (use HH:MM)',
    ],
    [
      'fuso desconhecido',
      { timezone: 'Mars/Olympus' },
      'Fuso horário desconhecido: Mars/Olympus',
    ],
    [
      'dia da semana fora de 0..6',
      { byWeekday: [7] },
      'Dia da semana inválido (0 = domingo … 6 = sábado)',
    ],
    ['dia da semana repetido', { byWeekday: [1, 1] }, 'Dia da semana repetido'],
    ['dia do mês 32', { byMonthday: 32 }, 'Dia do mês inválido (1 a 31)'],
    [
      'início inválido',
      { startsAt: new Date('nope') },
      'Início da vigência inválido',
    ],
    ['fim inválido', { endsAt: new Date('nope') }, 'Fim da vigência inválido'],
    [
      'fim antes do início',
      { endsAt: at('2026-09-01T00:00:00.000Z') },
      'O fim da vigência deve ser depois do início',
    ],
    [
      'antecedência negativa',
      { leadTimeMinutes: -1 },
      'A antecedência deve ser de 0 minuto ou mais',
    ],
  ])('refuses %s', (_label, overrides, message) => {
    expect(sdRecurrenceProblem(schedule(overrides))).toBe(message)
  })

  it('refuses a schedule that never fires inside the validity window', () => {
    const impossible = schedule({
      frequency: 'WEEKLY',
      byWeekday: [0],
      byMonthday: null,
      startsAt: at('2026-10-01T03:00:00.000Z'),
      endsAt: at('2026-10-02T00:00:00.000Z'),
    })
    expect(sdRecurrenceProblem(impossible)).toBe(
      'Esta agenda não gera nenhuma ocorrência dentro da vigência',
    )
  })
})

describe('describeSdRecurrence', () => {
  it.each([
    [
      schedule({ frequency: 'DAILY', byMonthday: null }),
      'A cada dia, às 08:00',
    ],
    [
      schedule({ frequency: 'DAILY', interval: 2, byMonthday: null }),
      'A cada 2 dias, às 08:00',
    ],
    [
      schedule({ frequency: 'DAILY', byMonthday: null, byWeekday: [1, 3] }),
      'A cada dia, somente segunda, quarta, às 08:00',
    ],
    [
      schedule({
        frequency: 'DAILY',
        interval: 2,
        byMonthday: null,
        byWeekday: [6],
      }),
      'A cada 2 dias, somente sábado, às 08:00',
    ],
    [
      schedule({ frequency: 'WEEKLY', byMonthday: null, byWeekday: [5] }),
      'A cada semana (sexta), às 08:00',
    ],
    [
      schedule({ frequency: 'WEEKLY', interval: 3, byMonthday: null }),
      'A cada 3 semanas, às 08:00',
    ],
    [schedule({ byMonthday: 10 }), 'A cada mês, no dia 10, às 08:00'],
    [
      schedule({ interval: 2, byMonthday: null }),
      'A cada 2 meses, no dia de início, às 08:00',
    ],
    [
      schedule({ frequency: 'YEARLY', byMonthday: null }),
      'A cada ano, às 08:00',
    ],
    [
      schedule({ frequency: 'YEARLY', interval: 5, byMonthday: null }),
      'A cada 5 anos, às 08:00',
    ],
  ])('describes the schedule in pt-BR', (input, expected) => {
    expect(describeSdRecurrence(input)).toBe(expected)
  })

  it('labels every weekday', () => {
    expect(SD_WEEKDAY_LABELS).toHaveLength(7)
    expect(SD_WEEKDAY_LABELS[0]).toBe('domingo')
  })
})
