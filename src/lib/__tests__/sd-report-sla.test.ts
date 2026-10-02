import { describe, expect, it } from 'vitest'
import {
  createFakeSdReportTicketRow,
  SD_REPORT_PERIOD_END,
  SD_REPORT_PERIOD_START,
} from '@/src/__tests__/factories/sd-report.factory'
import {
  computeSdSlaReport,
  formatSdReportMinutes,
  formatSdReportPercent,
  type SdReportTicketRow,
} from '@/src/lib/servicedesk/report-sla'
import type { SdCalendar } from '@/src/lib/servicedesk/sla'

/**
 * Apuração do relatório de SLA. O período é setembro/2026 e os chamados são
 * 24×7, exceto no teste de horário útil — aí a conta precisa respeitar o
 * expediente do calendário do chamado.
 */

const NOW = new Date('2026-10-01T12:00:00.000Z')

function compute(rows: SdReportTicketRow[], now = NOW, maxViolations?: number) {
  return computeSdSlaReport({
    periodStart: SD_REPORT_PERIOD_START,
    periodEnd: SD_REPORT_PERIOD_END,
    rows,
    now,
    ...(maxViolations === undefined ? {} : { maxViolations }),
  })
}

const BUSINESS_HOURS: SdCalendar = {
  timezone: 'UTC',
  schedule: {
    mon: [['09:00', '18:00']],
    tue: [['09:00', '18:00']],
    wed: [['09:00', '18:00']],
    thu: [['09:00', '18:00']],
    fri: [['09:00', '18:00']],
  },
  holidays: [],
  is24x7: false,
}

describe('computeSdSlaReport() — volume', () => {
  it('counts opened, resolved, closed and the backlog at the end', () => {
    const summary = compute([
      // Aberto e resolvido no período.
      createFakeSdReportTicketRow({ number: 1 }),
      // Aberto no período e ainda em aberto.
      createFakeSdReportTicketRow({
        number: 2,
        firstRespondedAt: null,
        resolvedAt: null,
        resolutionDueAt: null,
        csatScore: null,
      }),
      // Aberto antes do período e fechado dentro dele.
      createFakeSdReportTicketRow({
        number: 3,
        createdAt: new Date('2026-08-20T12:00:00.000Z'),
        firstRespondedAt: new Date('2026-08-20T12:10:00.000Z'),
        resolvedAt: new Date('2026-09-03T12:00:00.000Z'),
        closedAt: new Date('2026-09-05T12:00:00.000Z'),
      }),
      // Resolvido depois do fim do período: contava como backlog no dia 30.
      createFakeSdReportTicketRow({
        number: 4,
        resolvedAt: new Date('2026-10-02T12:00:00.000Z'),
        resolutionDueAt: null,
        csatScore: null,
      }),
    ])

    expect(summary.volume).toEqual({
      opened: 3,
      resolved: 2,
      closed: 1,
      openAtEnd: 2,
    })
    expect(summary.periodStart).toBe(SD_REPORT_PERIOD_START.toISOString())
    expect(summary.periodEnd).toBe(SD_REPORT_PERIOD_END.toISOString())
  })

  it('ignores rows outside the period (margin from the repository)', () => {
    const summary = compute([
      createFakeSdReportTicketRow({
        number: 9,
        createdAt: new Date('2026-07-01T12:00:00.000Z'),
        firstRespondedAt: new Date('2026-07-01T12:30:00.000Z'),
        resolvedAt: new Date('2026-07-02T12:00:00.000Z'),
        closedAt: new Date('2026-07-02T12:00:00.000Z'),
      }),
    ])

    expect(summary.volume).toEqual({
      opened: 0,
      resolved: 0,
      closed: 0,
      openAtEnd: 0,
    })
    expect(summary.firstResponse.measured).toBe(0)
    expect(summary.resolution.compliance).toBeNull()
    expect(summary.byCustomer).toEqual([])
  })
})

describe('computeSdSlaReport() — cumprimento de SLA', () => {
  it('splits met and breached timers and lists the violations', () => {
    const summary = compute([
      createFakeSdReportTicketRow({ number: 1 }),
      createFakeSdReportTicketRow({
        number: 2,
        title: 'Atendimento atrasado',
        // Respondeu 1 h depois do prazo e resolveu 2 h depois.
        firstResponseDueAt: new Date('2026-09-04T12:00:00.000Z'),
        firstRespondedAt: new Date('2026-09-04T13:00:00.000Z'),
        resolutionDueAt: new Date('2026-09-04T16:00:00.000Z'),
        resolvedAt: new Date('2026-09-04T18:00:00.000Z'),
        createdAt: new Date('2026-09-04T11:00:00.000Z'),
      }),
    ])

    expect(summary.firstResponse).toMatchObject({
      measured: 2,
      met: 1,
      breached: 1,
      compliance: 50,
    })
    expect(summary.resolution).toMatchObject({
      measured: 2,
      met: 1,
      breached: 1,
      compliance: 50,
    })
    expect(summary.violationCount).toBe(2)
    expect(summary.violations.map((v) => v.kind)).toEqual([
      'RESOLUTION',
      'FIRST_RESPONSE',
    ])
    expect(summary.violations[0]).toMatchObject({
      number: 2,
      code: 'INC-000002',
      customer: 'ACME',
      delayMinutes: 120,
    })
    expect(summary.violations[1].delayMinutes).toBe(60)
  })

  it('leaves tickets without a deadline out of the compliance', () => {
    const summary = compute([
      createFakeSdReportTicketRow({
        number: 1,
        firstResponseDueAt: null,
        resolutionDueAt: null,
      }),
    ])

    expect(summary.firstResponse.measured).toBe(0)
    expect(summary.firstResponse.compliance).toBeNull()
    expect(summary.resolution.measured).toBe(0)
    // O tempo médio continua medido (houve resposta e resolução).
    expect(summary.firstResponse.averageMinutes).toBe(30)
    expect(summary.resolution.averageMinutes).toBe(360)
    expect(summary.violationCount).toBe(0)
  })

  it('counts an open ticket past its resolution deadline as a violation', () => {
    const summary = compute([
      createFakeSdReportTicketRow({
        number: 7,
        createdAt: new Date('2026-09-28T12:00:00.000Z'),
        firstRespondedAt: null,
        resolvedAt: null,
        closedAt: null,
        resolutionDueAt: new Date('2026-09-29T12:00:00.000Z'),
        csatScore: null,
      }),
    ])

    expect(summary.volume.openAtEnd).toBe(1)
    expect(summary.violationCount).toBe(1)
    expect(summary.violations[0]).toMatchObject({
      kind: 'RESOLUTION',
      number: 7,
      // Do vencimento até o fim do período (29/09 12:00 → 01/10 03:00).
      delayMinutes: 2340,
    })
  })

  it('measures an ongoing violation up to now while the period is open', () => {
    const rows = [
      createFakeSdReportTicketRow({
        number: 8,
        createdAt: new Date('2026-09-30T12:00:00.000Z'),
        firstRespondedAt: null,
        resolvedAt: null,
        resolutionDueAt: new Date('2026-09-30T14:00:00.000Z'),
        csatScore: null,
      }),
    ]
    const summary = computeSdSlaReport({
      periodStart: SD_REPORT_PERIOD_START,
      // Período em andamento (CURRENT_MONTH): o fim é "agora".
      periodEnd: new Date('2026-09-30T16:00:00.000Z'),
      rows,
      now: new Date('2026-09-30T15:00:00.000Z'),
    })

    expect(summary.violations[0].delayMinutes).toBe(60)
  })

  it('truncates the listed violations but keeps the total', () => {
    const rows = Array.from({ length: 4 }, (_, index) =>
      createFakeSdReportTicketRow({
        number: index + 1,
        createdAt: new Date('2026-09-10T10:00:00.000Z'),
        firstResponseDueAt: new Date('2026-09-10T11:00:00.000Z'),
        // 12:00, 13:00, 14:00 e 15:00 — atrasos crescentes.
        firstRespondedAt: new Date(`2026-09-10T1${2 + index}:00:00.000Z`),
        resolutionDueAt: null,
        resolvedAt: null,
        closedAt: null,
        csatScore: null,
      }),
    )
    const summary = compute(rows, NOW, 2)

    expect(summary.violationCount).toBe(4)
    expect(summary.violations).toHaveLength(2)
    // Ordenadas pelo maior atraso.
    expect(summary.violations[0].delayMinutes).toBeGreaterThan(
      summary.violations[1].delayMinutes,
    )
  })
})

describe('computeSdSlaReport() — horário útil', () => {
  it('measures MTTR in business minutes of the ticket calendar', () => {
    const summary = compute([
      createFakeSdReportTicketRow({
        number: 1,
        calendar: BUSINESS_HOURS,
        // Sexta 17:00 → segunda 10:00: 1 h na sexta + 1 h na segunda.
        createdAt: new Date('2026-09-04T17:00:00.000Z'),
        firstResponseDueAt: null,
        firstRespondedAt: null,
        resolutionDueAt: null,
        resolvedAt: new Date('2026-09-07T10:00:00.000Z'),
        csatScore: null,
      }),
    ])

    expect(summary.resolution.averageMinutes).toBe(120)
  })

  it('falls back to wall clock when the row has no calendar', () => {
    const row = createFakeSdReportTicketRow({ number: 1 })
    const summary = compute([
      { ...row, calendar: undefined as unknown as SdCalendar },
    ])

    expect(summary.resolution.averageMinutes).toBe(360)
  })
})

describe('computeSdSlaReport() — CSAT e quebras', () => {
  it('averages the CSAT of the period and fills the distribution', () => {
    const summary = compute([
      createFakeSdReportTicketRow({ number: 1, csatScore: 5 }),
      createFakeSdReportTicketRow({ number: 2, csatScore: 4 }),
      createFakeSdReportTicketRow({ number: 3, csatScore: null }),
    ])

    expect(summary.csat.answered).toBe(2)
    expect(summary.csat.average).toBe(4.5)
    expect(summary.csat.distribution).toEqual([
      { score: 1, count: 0 },
      { score: 2, count: 0 },
      { score: 3, count: 0 },
      { score: 4, count: 1 },
      { score: 5, count: 1 },
    ])
  })

  it('has no CSAT when nobody answered', () => {
    const summary = compute([
      createFakeSdReportTicketRow({ number: 1, csatScore: null }),
    ])

    expect(summary.csat).toMatchObject({ answered: 0, average: null })
  })

  it('breaks down by department, customer and priority, biggest first', () => {
    const summary = compute([
      createFakeSdReportTicketRow({ number: 1 }),
      createFakeSdReportTicketRow({ number: 2 }),
      createFakeSdReportTicketRow({
        number: 3,
        departmentId: null,
        departmentName: null,
        customerId: 'cus2',
        customerName: 'Beta',
        priorityId: null,
        priorityName: null,
        // Violou a resolução.
        resolutionDueAt: new Date('2026-09-02T13:00:00.000Z'),
      }),
    ])

    expect(summary.byDepartment.map((row) => [row.label, row.opened])).toEqual([
      ['Infra', 2],
      ['Sem departamento', 1],
    ])
    expect(summary.byCustomer[0]).toMatchObject({
      id: 'cus1',
      label: 'ACME',
      opened: 2,
      resolved: 2,
      breached: 0,
      compliance: 100,
      averageResolutionMinutes: 360,
    })
    expect(summary.byCustomer[1]).toMatchObject({
      label: 'Beta',
      breached: 1,
      compliance: 0,
    })
    expect(summary.byPriority.map((row) => row.label)).toEqual([
      'Alta',
      'Sem prioridade',
    ])
  })

  it('sorts equal volumes by label', () => {
    const summary = compute([
      createFakeSdReportTicketRow({
        number: 1,
        customerId: 'z',
        customerName: 'Zeta',
      }),
      createFakeSdReportTicketRow({
        number: 2,
        customerId: 'a',
        customerName: 'Alfa',
      }),
    ])

    expect(summary.byCustomer.map((row) => row.label)).toEqual(['Alfa', 'Zeta'])
  })
})

describe('computeSdSlaReport() — bordas', () => {
  it('defaults `now` and `maxViolations` when the caller omits them', () => {
    const summary = computeSdSlaReport({
      periodStart: SD_REPORT_PERIOD_START,
      periodEnd: SD_REPORT_PERIOD_END,
      rows: [createFakeSdReportTicketRow({ number: 1 })],
    })

    expect(summary.volume.resolved).toBe(1)
    expect(summary.violations).toEqual([])
  })

  it('counts a ticket closed after the period as backlog', () => {
    const summary = compute([
      createFakeSdReportTicketRow({
        number: 5,
        createdAt: new Date('2026-09-20T12:00:00.000Z'),
        resolvedAt: null,
        resolutionDueAt: null,
        closedAt: new Date('2026-10-05T12:00:00.000Z'),
        csatScore: null,
      }),
    ])

    expect(summary.volume).toMatchObject({ closed: 0, openAtEnd: 1 })
  })

  it('breaks a tie between violations by ticket number', () => {
    const rows = [2, 1].map((number) =>
      createFakeSdReportTicketRow({
        number,
        createdAt: new Date('2026-09-10T10:00:00.000Z'),
        firstResponseDueAt: new Date('2026-09-10T11:00:00.000Z'),
        firstRespondedAt: new Date('2026-09-10T12:00:00.000Z'),
        resolutionDueAt: null,
        resolvedAt: null,
        closedAt: null,
        csatScore: null,
      }),
    )
    const summary = compute(rows)

    expect(summary.violations.map((violation) => violation.number)).toEqual([
      1, 2,
    ])
  })
})

describe('formatSdReportMinutes() / formatSdReportPercent()', () => {
  it.each([
    [null, '—'],
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [155, '2 h 35 min'],
  ])('formats %s minutes as %s', (minutes, expected) => {
    expect(formatSdReportMinutes(minutes)).toBe(expected)
  })

  it.each([
    [null, '—'],
    [100, '100,0%'],
    [97.5, '97,5%'],
  ])('formats %s percent as %s', (value, expected) => {
    expect(formatSdReportPercent(value)).toBe(expected)
  })
})
