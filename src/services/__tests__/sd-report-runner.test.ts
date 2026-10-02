import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdReportRun,
  createFakeSdReportSummary,
  createFakeSdReportTicketRow,
  createFakeSdScheduledReport,
  SD_REPORT_PERIOD_END,
  SD_REPORT_PERIOD_START,
} from '@/src/__tests__/factories/sd-report.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/sd-report.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/lib/storage/s3')
vi.mock('@/src/lib/mail/servicedesk/send-sd-sla-report')
vi.mock('@/src/lib/servicedesk/report-pdf', () => ({
  renderSdSlaReportPdf: vi.fn(async () => Buffer.from('%PDF-1.7 fake')),
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getServicedeskReportsQueue: vi.fn(() => ({ add: vi.fn() })),
}))
vi.mock('../notification.service', () => ({
  NotificationService: { notifyUsers: vi.fn() },
}))

import { sendSdSlaReportEmail } from '@/src/lib/mail/servicedesk/send-sd-sla-report'
import { getServicedeskReportsQueue } from '@/src/lib/queue/queues'
import { renderSdSlaReportPdf } from '@/src/lib/servicedesk/report-pdf'
import { ensureBucket, putObject } from '@/src/lib/storage/s3'
import {
  SdReportDataRepository,
  SdReportRunRepository,
  SdScheduledReportRepository,
} from '@/src/repositories/sd-report.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { NotificationService } from '../notification.service'
import {
  generateSdReport,
  SdReportRunner,
  sdReportEmailIndicators,
} from '../sd-report-runner'

const reports = vi.mocked(SdScheduledReportRepository)
const runs = vi.mocked(SdReportRunRepository)
const data = vi.mocked(SdReportDataRepository)
const context = vi.mocked(SdTicketContextRepository)
const mail = vi.mocked(sendSdSlaReportEmail)
const upload = vi.mocked(putObject)
const bucket = vi.mocked(ensureBucket)
const pdf = vi.mocked(renderSdSlaReportPdf)
const notify = vi.mocked(NotificationService.notifyUsers)
const queueFactory = vi.mocked(getServicedeskReportsQueue)

const WS = 'ws1'
const NOW = new Date('2026-10-01T12:00:00.000Z')

/** Um chamado resolvido no prazo + um violado, em setembro/2026. */
function ticketRecords() {
  return [
    {
      id: 't1',
      number: 1,
      type: 'INCIDENT' as const,
      title: 'Link instável',
      createdAt: new Date('2026-09-02T12:00:00.000Z'),
      firstResponseDueAt: new Date('2026-09-02T13:00:00.000Z'),
      resolutionDueAt: new Date('2026-09-02T20:00:00.000Z'),
      firstRespondedAt: new Date('2026-09-02T12:30:00.000Z'),
      resolvedAt: new Date('2026-09-02T18:00:00.000Z'),
      closedAt: null,
      csatScore: 5,
      customerId: 'cus1',
      customer: { name: 'ACME' },
      departmentId: 'dep1',
      department: { name: 'Infra' },
      priorityId: 'pri1',
      priority: { name: 'Alta' },
      slaPolicy: null,
    },
    {
      id: 't2',
      number: 2,
      type: 'INCIDENT' as const,
      title: 'Atendimento atrasado',
      createdAt: new Date('2026-09-04T11:00:00.000Z'),
      firstResponseDueAt: new Date('2026-09-04T12:00:00.000Z'),
      resolutionDueAt: new Date('2026-09-04T16:00:00.000Z'),
      firstRespondedAt: new Date('2026-09-04T13:00:00.000Z'),
      resolvedAt: new Date('2026-09-04T18:00:00.000Z'),
      closedAt: null,
      csatScore: 2,
      customerId: 'cus1',
      customer: { name: 'ACME' },
      departmentId: 'dep1',
      department: { name: 'Infra' },
      priorityId: 'pri1',
      priority: { name: 'Alta' },
      // Chamado com política própria: o calendário vem dela.
      slaPolicy: {
        calendar: {
          timezone: 'UTC',
          schedule: {},
          holidays: [],
          is24x7: true,
        },
      },
    },
  ] as never
}

const baseInput = {
  workspaceId: WS,
  name: 'SLA mensal',
  scope: { customerIds: [], departmentIds: [], ticketTypes: [] },
  period: 'LAST_MONTH' as const,
  formats: ['PDF', 'CSV'] as ('PDF' | 'CSV')[],
  timezone: 'America/Sao_Paulo',
  recipients: ['gestor@example.com'],
  includeAccountOwners: false,
  source: 'test',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  data.findContext.mockResolvedValue(
    ok({
      workspaceName: 'Stratus',
      workspaceSlug: 'stratus',
      ticketPrefixes: null,
    }),
  )
  data.findDefaultCalendar.mockResolvedValue(ok(null))
  data.collectTickets.mockResolvedValue(ok(ticketRecords()))
  data.findCustomerContacts.mockResolvedValue(ok([]))
  runs.findByPeriod.mockResolvedValue(ok(null))
  runs.create.mockResolvedValue(ok(createFakeSdReportRun({ id: 'run1' })))
  runs.update.mockImplementation(async (id, patch) =>
    ok(createFakeSdReportRun({ id, ...patch })),
  )
  reports.update.mockResolvedValue(ok(createFakeSdScheduledReport()))
  reports.findById.mockResolvedValue(ok(createFakeSdScheduledReport()))
  reports.listDue.mockResolvedValue(ok([]))
  context.listEnabledWorkspaceIds.mockResolvedValue(ok([WS]))
  pdf.mockResolvedValue(Buffer.from('%PDF-1.7 fake'))
  upload.mockResolvedValue(undefined)
  bucket.mockResolvedValue(undefined)
  mail.mockResolvedValue({ id: 'email-1' } as never)
  notify.mockResolvedValue(ok(1))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('generateSdReport()', () => {
  it('measures the period, stores both files and sends the e-mail', async () => {
    const run = expectOk(await generateSdReport(baseInput))

    // Período: setembro/2026 no fuso do relatório.
    expect(data.collectTickets).toHaveBeenCalledWith(
      WS,
      baseInput.scope,
      SD_REPORT_PERIOD_START,
      SD_REPORT_PERIOD_END,
      expect.any(Number),
    )

    const created = runs.create.mock.calls[0][0]
    expect(created.status).toBe('GENERATED')
    expect(created.recipients).toEqual(['gestor@example.com'])
    const summary = created.summary as unknown as {
      volume: { opened: number }
      violationCount: number
    }
    expect(summary.volume.opened).toBe(2)
    expect(summary.violationCount).toBe(2)

    expect(bucket).toHaveBeenCalledWith('servicedesk')
    expect(upload).toHaveBeenCalledTimes(2)
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'servicedesk',
        key: 'ws1/reports/run1.pdf',
        contentType: 'application/pdf',
      }),
    )
    expect(runs.update).toHaveBeenCalledWith('run1', {
      pdfKey: 'ws1/reports/run1.pdf',
      csvKey: 'ws1/reports/run1.csv',
    })

    expect(mail).toHaveBeenCalledTimes(1)
    const email = mail.mock.calls[0][0]
    expect(email).toMatchObject({
      email: 'gestor@example.com',
      reportName: 'SLA mensal',
      periodLabel: '01/09/2026 a 30/09/2026',
      attached: true,
    })
    expect(email.attachments).toHaveLength(2)
    expect(email.indicators.map((i) => i.label)).toContain('MTTR')
    expect(email.violations).toHaveLength(2)

    expect(runs.update).toHaveBeenLastCalledWith('run1', {
      status: 'SENT',
      sentAt: NOW,
    })
    expect(run.status).toBe('SENT')
  })

  it('generates only the requested format', async () => {
    expectOk(await generateSdReport({ ...baseInput, formats: ['CSV'] }))

    expect(pdf).not.toHaveBeenCalled()
    expect(upload).toHaveBeenCalledTimes(1)
    expect(runs.update).toHaveBeenCalledWith('run1', {
      pdfKey: null,
      csvKey: 'ws1/reports/run1.csv',
    })
  })

  it('generates only the PDF when the CSV was not requested', async () => {
    expectOk(await generateSdReport({ ...baseInput, formats: ['PDF'] }))

    expect(upload).toHaveBeenCalledTimes(1)
    expect(runs.update).toHaveBeenCalledWith('run1', {
      pdfKey: 'ws1/reports/run1.pdf',
      csvKey: null,
    })
  })

  it('keeps the run as GENERATED when there is nobody to send to', async () => {
    const run = expectOk(
      await generateSdReport({ ...baseInput, recipients: [] }),
    )

    expect(mail).not.toHaveBeenCalled()
    expect(run.status).toBe('GENERATED')
  })

  it('does not touch the bucket when no format was asked', async () => {
    const run = expectOk(
      await generateSdReport({ ...baseInput, formats: [], recipients: [] }),
    )

    expect(bucket).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(run.status).toBe('GENERATED')
  })

  it('adds the account owners of the scope when asked', async () => {
    data.findCustomerContacts.mockResolvedValue(
      ok([
        {
          id: 'cus1',
          name: 'ACME',
          email: 'Contato@ACME.com',
          ownerEmail: 'gestor@example.com',
          ownerName: 'Ana',
        },
        {
          id: 'cus2',
          name: 'Beta',
          email: null,
          ownerEmail: null,
          ownerName: null,
        },
      ]),
    )

    expectOk(
      await generateSdReport({
        ...baseInput,
        includeAccountOwners: true,
        scope: { ...baseInput.scope, customerIds: ['cus1', 'cus2'] },
      }),
    )

    // Deduplicado e em minúsculas; sem o cliente sem e-mail.
    expect(runs.create.mock.calls[0][0].recipients).toEqual([
      'gestor@example.com',
      'contato@acme.com',
    ])
    expect(mail).toHaveBeenCalledTimes(2)
  })

  it('ignores the account owners when the scope has no customer', async () => {
    expectOk(
      await generateSdReport({ ...baseInput, includeAccountOwners: true }),
    )

    expect(data.findCustomerContacts).not.toHaveBeenCalled()
  })

  it('keeps going when the account owners cannot be read', async () => {
    data.findCustomerContacts.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectOk(
      await generateSdReport({
        ...baseInput,
        includeAccountOwners: true,
        scope: { ...baseInput.scope, customerIds: ['cus1'] },
      }),
    )

    expect(runs.create.mock.calls[0][0].recipients).toEqual([
      'gestor@example.com',
    ])
  })

  it('sends without attachment when the files are too big', async () => {
    pdf.mockResolvedValue(Buffer.alloc(9 * 1024 * 1024))

    expectOk(await generateSdReport(baseInput))

    const email = mail.mock.calls[0][0]
    expect(email.attached).toBe(false)
    expect(email.attachments).toBeUndefined()
  })

  it('does not resend the same period of a schedule', async () => {
    const report = createFakeSdScheduledReport()
    runs.findByPeriod.mockResolvedValue(
      ok(createFakeSdReportRun({ id: 'old', status: 'SENT' })),
    )

    const run = expectOk(await generateSdReport({ ...baseInput, report }))

    expect(run.id).toBe('old')
    expect(runs.create).not.toHaveBeenCalled()
    expect(mail).not.toHaveBeenCalled()
  })

  it('stamps lastRunAt of the schedule', async () => {
    const report = createFakeSdScheduledReport()

    expectOk(await generateSdReport({ ...baseInput, report }))

    expect(reports.update).toHaveBeenCalledWith('rep1', WS, { lastRunAt: NOW })
  })

  it('survives a failure stamping lastRunAt', async () => {
    reports.update.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    const run = expectOk(
      await generateSdReport({
        ...baseInput,
        report: createFakeSdScheduledReport(),
      }),
    )

    expect(run.status).toBe('SENT')
  })

  it('notifies the requester of an on-demand report', async () => {
    expectOk(await generateSdReport({ ...baseInput, requestedById: 'u1' }))

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS,
        userIds: ['u1'],
        kind: 'SD_REPORT_READY',
        href: '/stratus/servicedesk/settings?tab=reports',
      }),
    )
  })

  it('survives a failure of the in-app notification', async () => {
    notify.mockResolvedValue({ ok: false, error: databaseError('x') } as never)

    expectOk(await generateSdReport({ ...baseInput, requestedById: 'u1' }))
  })

  it('counts only the recipients that really got the e-mail', async () => {
    mail.mockRejectedValueOnce(new Error('bounce'))

    const run = expectOk(
      await generateSdReport({
        ...baseInput,
        recipients: ['a@example.com', 'b@example.com'],
      }),
    )

    expect(run.status).toBe('SENT')
    expect(mail).toHaveBeenCalledTimes(2)
  })

  it('stays GENERATED when every e-mail fails', async () => {
    mail.mockRejectedValue('estranho')

    const run = expectOk(await generateSdReport(baseInput))

    expect(run.status).toBe('GENERATED')
  })

  it('records FAILED when the rendering or the upload breaks', async () => {
    upload.mockRejectedValue(new Error('MinIO fora do ar'))

    const error = expectErr(
      await generateSdReport(baseInput),
      'SD_REPORT_GENERATION_FAILED',
    )

    expect(error.message).toContain('MinIO fora do ar')
    expect(runs.update).toHaveBeenCalledWith('run1', {
      status: 'FAILED',
      error: 'MinIO fora do ar',
    })
  })

  it('records FAILED on a non-Error throw', async () => {
    upload.mockRejectedValue('estranho')

    expectErr(await generateSdReport(baseInput), 'SD_REPORT_GENERATION_FAILED')
    expect(runs.update).toHaveBeenCalledWith('run1', {
      status: 'FAILED',
      error: 'estranho',
    })
  })

  it('propagates the database errors of the pipeline', async () => {
    runs.findByPeriod.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expectErr(
      await generateSdReport({
        ...baseInput,
        report: createFakeSdScheduledReport(),
      }),
      'DATABASE_ERROR',
    )

    runs.findByPeriod.mockResolvedValue(ok(null))
    data.findContext.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expectErr(await generateSdReport(baseInput), 'DATABASE_ERROR')

    data.findContext.mockResolvedValue(ok(null))
    expectErr(await generateSdReport(baseInput), 'SD_REPORT_GENERATION_FAILED')

    data.findContext.mockResolvedValue(
      ok({
        workspaceName: 'Stratus',
        workspaceSlug: 'stratus',
        ticketPrefixes: null,
      }),
    )
    data.findDefaultCalendar.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expectErr(await generateSdReport(baseInput), 'DATABASE_ERROR')

    data.findDefaultCalendar.mockResolvedValue(ok(null))
    data.collectTickets.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expectErr(await generateSdReport(baseInput), 'DATABASE_ERROR')

    data.collectTickets.mockResolvedValue(ok(ticketRecords()))
    runs.create.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expectErr(await generateSdReport(baseInput), 'DATABASE_ERROR')
  })

  it('propagates a failure saving the file keys', async () => {
    runs.update.mockResolvedValueOnce({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(await generateSdReport(baseInput), 'DATABASE_ERROR')
    expect(mail).not.toHaveBeenCalled()
  })

  it('propagates a failure marking the run as SENT', async () => {
    runs.update
      .mockResolvedValueOnce(ok(createFakeSdReportRun({ id: 'run1' })))
      .mockResolvedValueOnce({
        ok: false,
        error: databaseError('boom'),
      } as never)

    expectErr(await generateSdReport(baseInput), 'DATABASE_ERROR')
  })

  it('propagates a failure recording the FAILED run', async () => {
    upload.mockRejectedValue(new Error('MinIO fora do ar'))
    runs.update.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(await generateSdReport(baseInput), 'DATABASE_ERROR')
  })

  it('uses the default calendar when the ticket has no policy', async () => {
    data.findDefaultCalendar.mockResolvedValue(
      ok({
        timezone: 'UTC',
        schedule: { wed: [['09:00', '18:00']], fri: [['09:00', '18:00']] },
        holidays: [],
        is24x7: false,
      } as never),
    )

    expectOk(await generateSdReport(baseInput))

    const summary = runs.create.mock.calls[0][0].summary as unknown as {
      resolution: { averageMinutes: number }
    }
    // O primeiro chamado (quarta 12:00 → 18:00) rende 6 h úteis; o segundo é
    // 24×7 pela política própria (7 h).
    expect(summary.resolution.averageMinutes).toBe(390)
  })

  it('labels a ticket with no customer, department or priority', async () => {
    data.collectTickets.mockResolvedValue(
      ok([
        {
          ...(ticketRecords() as unknown as Record<string, unknown>[])[0],
          customerId: null,
          customer: null,
          departmentId: null,
          department: null,
          priorityId: null,
          priority: null,
        },
      ]) as never,
    )

    expectOk(await generateSdReport(baseInput))

    const summary = runs.create.mock.calls[0][0].summary as unknown as {
      byCustomer: { label: string }[]
      byDepartment: { label: string }[]
      byPriority: { label: string }[]
    }
    expect(summary.byCustomer[0].label).toBe('Sem cliente')
    expect(summary.byDepartment[0].label).toBe('Sem departamento')
    expect(summary.byPriority[0].label).toBe('Sem prioridade')
  })

  it('honours an explicit period (the tick stamps it)', async () => {
    expectOk(
      await generateSdReport({
        ...baseInput,
        periodStart: new Date('2026-08-01T03:00:00.000Z'),
        periodEnd: new Date('2026-09-01T03:00:00.000Z'),
      }),
    )

    expect(data.collectTickets).toHaveBeenCalledWith(
      WS,
      baseInput.scope,
      new Date('2026-08-01T03:00:00.000Z'),
      new Date('2026-09-01T03:00:00.000Z'),
      expect.any(Number),
    )
  })
})

describe('sdReportEmailIndicators()', () => {
  it('shows a dash for the CSAT when nobody answered', () => {
    const indicators = sdReportEmailIndicators(
      createFakeSdReportSummary([
        createFakeSdReportTicketRow({ csatScore: null }),
      ]),
    )

    expect(indicators.find((i) => i.label === 'CSAT')?.value).toBe('—')
  })

  it('shows the CSAT average with the answer count', () => {
    const indicators = sdReportEmailIndicators(createFakeSdReportSummary())

    expect(indicators.find((i) => i.label === 'CSAT')?.value).toBe('5,0 (1)')
  })
})

describe('SdReportRunner.runTick()', () => {
  it('does nothing without due schedules', async () => {
    const result = await SdReportRunner.runTick(NOW)

    expect(result).toEqual({ due: 0, enqueued: 0, errors: 0 })
    expect(context.listEnabledWorkspaceIds).not.toHaveBeenCalled()
  })

  it('enqueues one job per due schedule and reschedules it', async () => {
    const add = vi.fn()
    queueFactory.mockReturnValue({ add } as never)
    reports.listDue.mockResolvedValue(
      ok([
        createFakeSdScheduledReport({
          nextRunAt: new Date('2026-10-01T10:00:00.000Z'),
        }),
      ]),
    )

    const result = await SdReportRunner.runTick(NOW)

    expect(reports.update).toHaveBeenCalledWith('rep1', WS, {
      nextRunAt: new Date('2026-11-01T10:00:00.000Z'),
    })
    expect(add).toHaveBeenCalledWith('generate-report', {
      workspaceId: WS,
      reportId: 'rep1',
      periodStart: SD_REPORT_PERIOD_START.toISOString(),
      periodEnd: SD_REPORT_PERIOD_END.toISOString(),
    })
    expect(result).toEqual({ due: 1, enqueued: 1, errors: 0 })
  })

  it('skips a workspace with the module disabled but still reschedules', async () => {
    const add = vi.fn()
    queueFactory.mockReturnValue({ add } as never)
    reports.listDue.mockResolvedValue(ok([createFakeSdScheduledReport()]))
    context.listEnabledWorkspaceIds.mockResolvedValue(ok(['other']))

    const result = await SdReportRunner.runTick(NOW)

    expect(reports.update).toHaveBeenCalled()
    expect(add).not.toHaveBeenCalled()
    expect(result).toEqual({ due: 0, enqueued: 0, errors: 0 })
  })

  it('counts an error when the reschedule or the enqueue fails', async () => {
    reports.listDue.mockResolvedValue(ok([createFakeSdScheduledReport()]))
    reports.update.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expect(await SdReportRunner.runTick(NOW)).toEqual({
      due: 0,
      enqueued: 0,
      errors: 1,
    })

    reports.update.mockResolvedValue(ok(createFakeSdScheduledReport()))
    queueFactory.mockReturnValue({
      add: vi.fn(async () => {
        throw new Error('redis fora')
      }),
    } as never)

    expect(await SdReportRunner.runTick(NOW)).toEqual({
      due: 1,
      enqueued: 0,
      errors: 1,
    })
  })

  it('counts an error on a non-Error enqueue failure', async () => {
    reports.listDue.mockResolvedValue(ok([createFakeSdScheduledReport()]))
    queueFactory.mockReturnValue({
      add: vi.fn(async () => {
        throw 'redis estranho'
      }),
    } as never)

    expect(await SdReportRunner.runTick(NOW)).toEqual({
      due: 1,
      enqueued: 0,
      errors: 1,
    })
  })

  it('counts an error when the queries fail', async () => {
    reports.listDue.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expect(await SdReportRunner.runTick(NOW)).toEqual({
      due: 0,
      enqueued: 0,
      errors: 1,
    })

    reports.listDue.mockResolvedValue(ok([createFakeSdScheduledReport()]))
    context.listEnabledWorkspaceIds.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expect(await SdReportRunner.runTick(NOW)).toEqual({
      due: 0,
      enqueued: 0,
      errors: 1,
    })
  })
})

describe('SdReportRunner.generateFromJob()', () => {
  it('loads the schedule and generates with its scope', async () => {
    const run = expectOk(
      await SdReportRunner.generateFromJob({
        workspaceId: WS,
        reportId: 'rep1',
        periodStart: SD_REPORT_PERIOD_START.toISOString(),
        periodEnd: SD_REPORT_PERIOD_END.toISOString(),
      }),
    )

    expect(reports.findById).toHaveBeenCalledWith('rep1', WS)
    expect(run.status).toBe('SENT')
    expect(mail).toHaveBeenCalledTimes(1)
  })

  it('overrides the recipients of a one-off send', async () => {
    expectOk(
      await SdReportRunner.generateFromJob({
        workspaceId: WS,
        reportId: 'rep1',
        requestedById: 'u1',
        recipients: ['ops@example.com'],
      }),
    )

    expect(mail.mock.calls[0][0].email).toBe('ops@example.com')
    expect(notify).toHaveBeenCalled()
  })

  it('refuses a payload without a schedule or with an unknown one', async () => {
    expectErr(
      await SdReportRunner.generateFromJob({ workspaceId: WS }),
      'SD_REPORT_NOT_FOUND',
    )

    reports.findById.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expectErr(
      await SdReportRunner.generateFromJob({
        workspaceId: WS,
        reportId: 'nope',
      }),
      'SD_REPORT_NOT_FOUND',
    )
  })
})
