import { describe, expect, it } from 'vitest'
import {
  formatSdReportDate,
  formatSdReportDateTime,
  formatSdReportRange,
  isValidSdReportTimeZone,
  sdReportNextRunAt,
  sdReportPeriodRange,
  sdReportScheduleProblem,
} from '@/src/lib/servicedesk/report-schedule'

/**
 * Agenda e período no **fuso do relatório**. Os testes rodam com o runner em
 * UTC (como o CI), então qualquer conta feita no fuso do servidor apareceria
 * aqui como erro de um dia ou de três horas.
 */

const SP = 'America/Sao_Paulo'

describe('sdReportPeriodRange()', () => {
  it('takes the previous civil month in the report timezone', () => {
    const range = sdReportPeriodRange(
      'LAST_MONTH',
      new Date('2026-10-05T12:00:00.000Z'),
      SP,
    )

    // 01/09 00:00 e 01/10 00:00 em São Paulo = 03:00 UTC.
    expect(range.start.toISOString()).toBe('2026-09-01T03:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-10-01T03:00:00.000Z')
  })

  it('crosses the year on january', () => {
    const range = sdReportPeriodRange(
      'LAST_MONTH',
      new Date('2027-01-10T12:00:00.000Z'),
      SP,
    )

    // O Brasil não tem mais horário de verão: dezembro também é -03:00.
    expect(range.start.toISOString()).toBe('2026-12-01T03:00:00.000Z')
    expect(range.end.toISOString()).toBe('2027-01-01T03:00:00.000Z')
  })

  it('runs the current month up to now', () => {
    const now = new Date('2026-10-05T12:00:00.000Z')
    const range = sdReportPeriodRange('CURRENT_MONTH', now, SP)

    expect(range.start.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(range.end.toISOString()).toBe(now.toISOString())
  })

  it.each([
    ['LAST_WEEK' as const, '2026-09-28T03:00:00.000Z'],
    ['LAST_30_DAYS' as const, '2026-09-05T03:00:00.000Z'],
    ['LAST_90_DAYS' as const, '2026-07-07T03:00:00.000Z'],
  ])('closes %s at the start of today', (period, expectedStart) => {
    const range = sdReportPeriodRange(
      period,
      new Date('2026-10-05T12:00:00.000Z'),
      SP,
    )

    expect(range.start.toISOString()).toBe(expectedStart)
    expect(range.end.toISOString()).toBe('2026-10-05T03:00:00.000Z')
  })

  it('falls back to UTC on an unknown timezone', () => {
    const range = sdReportPeriodRange(
      'LAST_MONTH',
      new Date('2026-10-05T12:00:00.000Z'),
      'Mars/Olympus',
    )

    expect(range.start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })
})

describe('sdReportScheduleProblem()', () => {
  it('accepts a valid schedule', () => {
    expect(
      sdReportScheduleProblem({
        dayOfMonth: 1,
        atTime: '07:00',
        timezone: SP,
      }),
    ).toBeNull()
  })

  it.each([
    [{ timezone: 'Mars/Olympus' }, 'Fuso horário desconhecido: Mars/Olympus'],
    [{ atTime: '25:00' }, 'Horário inválido (use HH:MM)'],
    [{ dayOfMonth: 29 }, 'Dia do mês deve ficar entre 1 e 28'],
    [{ dayOfMonth: 0 }, 'Dia do mês deve ficar entre 1 e 28'],
    [{ dayOfMonth: 1.5 }, 'Dia do mês deve ficar entre 1 e 28'],
  ])('refuses %o', (patch, message) => {
    expect(
      sdReportScheduleProblem({
        dayOfMonth: 1,
        atTime: '07:00',
        timezone: SP,
        ...patch,
      }),
    ).toBe(message)
  })

  it('knows a valid IANA timezone', () => {
    expect(isValidSdReportTimeZone(SP)).toBe(true)
    expect(isValidSdReportTimeZone('Mars/Olympus')).toBe(false)
  })
})

describe('sdReportNextRunAt()', () => {
  it('takes the day of this month when it is still ahead', () => {
    const next = sdReportNextRunAt(
      { dayOfMonth: 10, atTime: '07:00', timezone: SP },
      new Date('2026-10-05T12:00:00.000Z'),
    )

    expect(next?.toISOString()).toBe('2026-10-10T10:00:00.000Z')
  })

  it('jumps to the next month when the time already passed', () => {
    const next = sdReportNextRunAt(
      { dayOfMonth: 1, atTime: '07:00', timezone: SP },
      new Date('2026-10-05T12:00:00.000Z'),
    )

    expect(next?.toISOString()).toBe('2026-11-01T10:00:00.000Z')
  })

  it('crosses the year', () => {
    const next = sdReportNextRunAt(
      { dayOfMonth: 1, atTime: '07:00', timezone: SP },
      new Date('2026-12-05T12:00:00.000Z'),
    )

    expect(next?.toISOString()).toBe('2027-01-01T10:00:00.000Z')
  })

  it('resolves a local time that does not exist (clock jumped forward)', () => {
    // 08/03/2026 02:30 não existe em Nova York (DST começa às 02:00).
    const next = sdReportNextRunAt(
      { dayOfMonth: 8, atTime: '02:30', timezone: 'America/New_York' },
      new Date('2026-03-01T12:00:00.000Z'),
    )

    // Cai depois do salto (03:30 EDT) em vez de desaparecer.
    expect(next?.toISOString()).toBe('2026-03-08T07:30:00.000Z')
  })

  it('resolves an ambiguous local time on the first pass', () => {
    // 01/11/2026 01:30 acontece duas vezes em Nova York (DST termina).
    const next = sdReportNextRunAt(
      { dayOfMonth: 1, atTime: '01:30', timezone: 'America/New_York' },
      new Date('2026-10-20T12:00:00.000Z'),
    )

    expect(next?.toISOString()).toBe('2026-11-01T05:30:00.000Z')
  })

  it('resolves a local time right after the clock jumped forward', () => {
    // 08/03/2026 03:30 em Nova York já é EDT, mas o palpite ingênuo cai no
    // EST anterior ao salto: o segundo passo é que acerta o instante.
    const next = sdReportNextRunAt(
      { dayOfMonth: 8, atTime: '03:30', timezone: 'America/New_York' },
      new Date('2026-03-01T12:00:00.000Z'),
    )

    expect(next?.toISOString()).toBe('2026-03-08T07:30:00.000Z')
  })

  it('refuses an invalid schedule', () => {
    expect(
      sdReportNextRunAt(
        { dayOfMonth: 1, atTime: '07:00', timezone: 'Mars/Olympus' },
        new Date('2026-10-05T12:00:00.000Z'),
      ),
    ).toBeNull()
  })
})

describe('formatação no fuso do relatório', () => {
  it('formats a date and a datetime in the report timezone', () => {
    // 01/10 00:30 UTC ainda é 30/09 21:30 em São Paulo.
    expect(formatSdReportDate('2026-10-01T00:30:00.000Z', SP)).toBe(
      '30/09/2026',
    )
    expect(formatSdReportDateTime('2026-10-01T00:30:00.000Z', SP)).toBe(
      '30/09/2026 21:30',
    )
    expect(
      formatSdReportDateTime(new Date('2026-10-01T00:30:00.000Z'), SP),
    ).toBe('30/09/2026 21:30')
  })

  it('falls back to UTC on an unknown timezone', () => {
    expect(formatSdReportDate('2026-10-01T00:30:00.000Z', 'Mars/Olympus')).toBe(
      '01/10/2026',
    )
  })

  it('falls back to UTC on an unknown timezone in the datetime too', () => {
    expect(
      formatSdReportDateTime('2026-10-01T00:30:00.000Z', 'Mars/Olympus'),
    ).toBe('01/10/2026 00:30')
  })

  it('shows the range with the last included day', () => {
    expect(
      formatSdReportRange(
        { start: '2026-09-01T03:00:00.000Z', end: '2026-10-01T03:00:00.000Z' },
        SP,
      ),
    ).toBe('01/09/2026 a 30/09/2026')
  })

  it('keeps a range of a single instant readable', () => {
    const at = new Date('2026-09-01T03:00:00.000Z')
    expect(formatSdReportRange({ start: at, end: at }, SP)).toBe(
      '01/09/2026 a 01/09/2026',
    )
  })

  it('formats midnight at the start of the day', () => {
    expect(formatSdReportDateTime('2026-09-01T03:00:00.000Z', SP)).toBe(
      '01/09/2026 00:00',
    )
  })
})
