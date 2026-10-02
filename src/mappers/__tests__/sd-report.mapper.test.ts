import { describe, expect, it } from 'vitest'
import {
  createFakeSdReportRun,
  createFakeSdReportSummary,
  createFakeSdScheduledReport,
} from '@/src/__tests__/factories/sd-report.factory'
import {
  EMPTY_SD_REPORT_LOOKUP,
  toSdReportRunDTO,
  toSdScheduledReportDTO,
} from '../sd-report.mapper'

describe('toSdScheduledReportDTO()', () => {
  it('maps the schedule with the scope labels', () => {
    const dto = toSdScheduledReportDTO(
      createFakeSdScheduledReport({
        customerIds: ['cus1', 'cus-gone'],
        departmentIds: ['dep1'],
        ticketTypes: ['INCIDENT'],
        lastRunAt: new Date('2026-10-01T10:00:00.000Z'),
        _count: { runs: 3 },
      }),
      {
        customers: new Map([['cus1', 'ACME']]),
        departments: new Map([['dep1', 'Infra']]),
      },
    )

    expect(dto).toMatchObject({
      id: 'rep1',
      name: 'SLA mensal',
      kind: 'SLA',
      period: 'LAST_MONTH',
      formats: ['PDF', 'CSV'],
      dayOfMonth: 1,
      atTime: '07:00',
      timezone: 'America/Sao_Paulo',
      recipients: ['gestor@example.com'],
      includeAccountOwners: false,
      active: true,
      runCount: 3,
      lastRunAt: '2026-10-01T10:00:00.000Z',
      nextRunAt: '2026-11-01T10:00:00.000Z',
    })
    // Id sem rótulo (cliente excluído) fica só no `customerIds`.
    expect(dto.customers).toEqual([{ id: 'cus1', name: 'ACME' }])
    expect(dto.customerIds).toEqual(['cus1', 'cus-gone'])
    expect(dto.departments).toEqual([{ id: 'dep1', name: 'Infra' }])
  })

  it('works without a lookup and with a paused schedule', () => {
    const dto = toSdScheduledReportDTO(
      createFakeSdScheduledReport({
        customerIds: ['cus1'],
        active: false,
        nextRunAt: null,
      }),
      EMPTY_SD_REPORT_LOOKUP,
    )

    expect(dto.customers).toEqual([])
    expect(dto.active).toBe(false)
    expect(dto.nextRunAt).toBeNull()
    expect(dto.lastRunAt).toBeNull()
  })

  it('defaults the lookup when the caller omits it', () => {
    const dto = toSdScheduledReportDTO(
      createFakeSdScheduledReport({ departmentIds: ['dep1'] }),
    )

    expect(dto.departments).toEqual([])
  })
})

describe('toSdReportRunDTO()', () => {
  it('derives the formats from the stored keys and keeps the summary', () => {
    const summary = createFakeSdReportSummary()
    const dto = toSdReportRunDTO(
      createFakeSdReportRun({
        status: 'SENT',
        summary: summary as never,
        pdfKey: 'ws1/reports/run1.pdf',
        csvKey: 'ws1/reports/run1.csv',
        sentAt: new Date('2026-10-01T10:05:00.000Z'),
        requestedById: 'u1',
        requestedBy: { id: 'u1', name: 'Ana' },
      }),
    )

    expect(dto).toMatchObject({
      status: 'SENT',
      reportName: 'SLA mensal',
      formats: ['PDF', 'CSV'],
      sentAt: '2026-10-01T10:05:00.000Z',
      requestedBy: { id: 'u1', name: 'Ana' },
      periodStart: '2026-09-01T03:00:00.000Z',
      periodEnd: '2026-10-01T03:00:00.000Z',
    })
    expect(dto.summary?.volume.resolved).toBe(1)
  })

  it('maps a failed on-demand run with no file', () => {
    const dto = toSdReportRunDTO(
      createFakeSdReportRun({
        status: 'FAILED',
        reportId: null,
        report: null,
        error: 'MinIO fora do ar',
        csvKey: null,
        pdfKey: null,
      }),
    )

    expect(dto).toMatchObject({
      status: 'FAILED',
      reportId: null,
      reportName: null,
      error: 'MinIO fora do ar',
      formats: [],
      sentAt: null,
      requestedBy: null,
    })
    expect(dto.summary).toBeNull()
  })

  it.each([
    ['an array', [] as never],
    ['a scalar', 'oops' as never],
  ])('drops a summary that is not an object (%s)', (_label, summary) => {
    const dto = toSdReportRunDTO(createFakeSdReportRun({ summary }))

    expect(dto.summary).toBeNull()
  })

  it('keeps only the CSV when the PDF was not requested', () => {
    const dto = toSdReportRunDTO(
      createFakeSdReportRun({ csvKey: 'ws1/reports/run1.csv' }),
    )

    expect(dto.formats).toEqual(['CSV'])
  })
})
