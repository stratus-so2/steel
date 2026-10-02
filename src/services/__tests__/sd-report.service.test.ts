import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdReportRun,
  createFakeSdScheduledReport,
} from '@/src/__tests__/factories/sd-report.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError } from '@/src/errors'
import { ok } from '@/src/lib/result'
import { toSdReportRunDTO } from '@/src/mappers/sd-report.mapper'
import type {
  CreateSdScheduledReportDTO,
  UpdateSdScheduledReportDTO,
} from '@/src/schemas/sd-report.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-report.repository')
vi.mock('@/lib/axiom/audit')
vi.mock('@/src/lib/storage/s3')
vi.mock('../sd-config-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-config-support')>()),
  assertSdRefs: vi.fn(async () => ok(true)),
}))
vi.mock('../sd-report-runner', () => ({ generateSdReport: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { getObject } from '@/src/lib/storage/s3'
import {
  SdReportDataRepository,
  SdReportRunRepository,
  SdScheduledReportRepository,
} from '@/src/repositories/sd-report.repository'
import { assertSdRefs } from '../sd-config-support'
import { SdReportService } from '../sd-report.service'
import { generateSdReport } from '../sd-report-runner'

const reports = vi.mocked(SdScheduledReportRepository)
const runs = vi.mocked(SdReportRunRepository)
const data = vi.mocked(SdReportDataRepository)
const refs = vi.mocked(assertSdRefs)
const generate = vi.mocked(generateSdReport)
const storage = vi.mocked(getObject)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const ADMIN = 'admin-1'
const NOW = new Date('2026-10-05T12:00:00.000Z')

const createDto: CreateSdScheduledReportDTO = {
  name: 'SLA mensal',
  kind: 'SLA',
  customerIds: ['cus1'],
  departmentIds: ['dep1'],
  ticketTypes: ['INCIDENT'],
  period: 'LAST_MONTH',
  formats: ['PDF', 'CSV'],
  dayOfMonth: 1,
  atTime: '07:00',
  timezone: 'America/Sao_Paulo',
  recipients: ['gestor@example.com'],
  includeAccountOwners: true,
  active: true,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  actAs('admin')
  refs.mockResolvedValue(ok(true))
  reports.list.mockResolvedValue(ok([createFakeSdScheduledReport()]))
  reports.findById.mockResolvedValue(ok(createFakeSdScheduledReport()))
  reports.create.mockResolvedValue(ok(createFakeSdScheduledReport()))
  reports.update.mockResolvedValue(ok(createFakeSdScheduledReport()))
  reports.softDelete.mockResolvedValue(ok(undefined))
  runs.list.mockResolvedValue(ok([createFakeSdReportRun()]))
  runs.findById.mockResolvedValue(
    ok(createFakeSdReportRun({ pdfKey: 'ws1/reports/run1.pdf' })),
  )
  data.findScopeLabels.mockResolvedValue(
    ok({
      customers: [{ id: 'cus1', name: 'ACME' }],
      departments: [{ id: 'dep1', name: 'Infra' }],
    }),
  )
  generate.mockResolvedValue(ok(toSdReportRunDTO(createFakeSdReportRun())))
  storage.mockResolvedValue(Buffer.from('%PDF-1.7'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('list() / get()', () => {
  it('lists the schedules with the scope labels for an agent', async () => {
    actAs('agent')
    const rows = expectOk(
      await SdReportService.list('agent-1', WS, { includeInactive: true }),
    )

    expect(reports.list).toHaveBeenCalledWith(WS, { includeInactive: true })
    expect(rows[0].name).toBe('SLA mensal')
  })

  it('defaults the filter to the active schedules', async () => {
    expectOk(await SdReportService.list(ADMIN, WS))

    expect(reports.list).toHaveBeenCalledWith(WS, { includeInactive: false })
  })

  it('refuses a requester, a non-member and a disabled module', async () => {
    actAs('requester')
    expectErr(await SdReportService.list('req-1', WS), 'SD_NOT_AGENT')

    actAs('stranger')
    expectErr(await SdReportService.list('nobody', WS), 'FORBIDDEN')

    actAs('disabled')
    expectErr(await SdReportService.list(ADMIN, WS), 'MODULE_DISABLED')
  })

  it('gets one schedule and 404s an unknown id', async () => {
    reports.findById.mockResolvedValue(
      ok(createFakeSdScheduledReport({ customerIds: ['cus1'] })),
    )

    const dto = expectOk(await SdReportService.get(ADMIN, WS, 'rep1'))
    expect(dto.customers).toEqual([{ id: 'cus1', name: 'ACME' }])

    reports.findById.mockResolvedValue({
      ok: false,
      error: { code: 'SD_CONFIG_NOT_FOUND', message: 'x' },
    } as never)
    expectErr(
      await SdReportService.get(ADMIN, WS, 'nope'),
      'SD_REPORT_NOT_FOUND',
    )
  })

  it('refuses a requester on get()', async () => {
    actAs('requester')

    expectErr(await SdReportService.get('req-1', WS, 'rep1'), 'SD_NOT_AGENT')
  })

  it('propagates a database error of the labels', async () => {
    data.findScopeLabels.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(await SdReportService.list(ADMIN, WS), 'DATABASE_ERROR')
    expectErr(await SdReportService.get(ADMIN, WS, 'rep1'), 'DATABASE_ERROR')
  })

  it('propagates a database error of the list', async () => {
    reports.list.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(await SdReportService.list(ADMIN, WS), 'DATABASE_ERROR')
  })
})

describe('create()', () => {
  it('creates the schedule with the next run already computed', async () => {
    expectOk(await SdReportService.create(ADMIN, WS, createDto))

    expect(reports.create).toHaveBeenCalledWith(WS, {
      ...createDto,
      createdById: ADMIN,
      // Dia 1 às 07:00 em São Paulo, já passado em outubro → novembro.
      nextRunAt: new Date('2026-11-01T10:00:00.000Z'),
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_scheduled_report',
        action: 'create',
      }),
    )
  })

  it('creates a paused schedule without a next run', async () => {
    expectOk(
      await SdReportService.create(ADMIN, WS, { ...createDto, active: false }),
    )

    expect(reports.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ nextRunAt: null }),
    )
  })

  it('refuses an unknown timezone with SD_REPORT_SCHEDULE_INVALID', async () => {
    expectErr(
      await SdReportService.create(ADMIN, WS, {
        ...createDto,
        timezone: 'Mars/Olympus',
      }),
      'SD_REPORT_SCHEDULE_INVALID',
    )
    expect(reports.create).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )
  })

  it('refuses a customer of another workspace', async () => {
    data.findScopeLabels.mockResolvedValue(
      ok({ customers: [], departments: [] }),
    )

    const error = expectErr(
      await SdReportService.create(ADMIN, WS, createDto),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(error.details).toEqual({ missing: ['cus1'] })
  })

  it('refuses a department of another workspace', async () => {
    refs.mockResolvedValue({
      ok: false,
      error: { code: 'SD_CONFIG_NOT_FOUND', message: 'Departamento' },
    } as never)

    expectErr(
      await SdReportService.create(ADMIN, WS, createDto),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('skips the customer check when the scope is empty', async () => {
    expectOk(
      await SdReportService.create(ADMIN, WS, {
        ...createDto,
        customerIds: [],
      }),
    )

    expect(data.findScopeLabels).toHaveBeenCalledTimes(1)
  })

  it('propagates a database error of the scope check and of the labels', async () => {
    data.findScopeLabels.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)
    expectErr(
      await SdReportService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )

    // Sem clientes no recorte, a checagem é pulada e o erro aparece só na
    // hora de resolver os rótulos do DTO.
    expectErr(
      await SdReportService.create(ADMIN, WS, {
        ...createDto,
        customerIds: [],
      }),
      'DATABASE_ERROR',
    )
  })

  it('propagates a database error of the create', async () => {
    reports.create.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(
      await SdReportService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )
  })

  it('refuses an agent (only module admins configure)', async () => {
    actAs('agent')

    expectErr(
      await SdReportService.create('agent-1', WS, createDto),
      'FORBIDDEN',
    )
    expect(reports.create).not.toHaveBeenCalled()
  })
})

describe('update()', () => {
  const patch: UpdateSdScheduledReportDTO = { atTime: '08:30' }

  it('recomputes the next run from the merged schedule', async () => {
    expectOk(await SdReportService.update(ADMIN, WS, 'rep1', patch))

    expect(reports.update).toHaveBeenCalledWith('rep1', WS, {
      ...patch,
      nextRunAt: new Date('2026-11-01T11:30:00.000Z'),
    })
  })

  it('pauses the schedule', async () => {
    expectOk(await SdReportService.update(ADMIN, WS, 'rep1', { active: false }))

    expect(reports.update).toHaveBeenCalledWith('rep1', WS, {
      active: false,
      nextRunAt: null,
    })
  })

  it('404s an unknown schedule', async () => {
    reports.findById.mockResolvedValue({
      ok: false,
      error: { code: 'SD_CONFIG_NOT_FOUND', message: 'x' },
    } as never)

    expectErr(
      await SdReportService.update(ADMIN, WS, 'nope', patch),
      'SD_REPORT_NOT_FOUND',
    )
  })

  it('refuses a broken schedule', async () => {
    expectErr(
      await SdReportService.update(ADMIN, WS, 'rep1', { atTime: '99:00' }),
      'SD_REPORT_SCHEDULE_INVALID',
    )
  })

  it('refuses a scope of another workspace', async () => {
    data.findScopeLabels.mockResolvedValue(
      ok({ customers: [], departments: [] }),
    )

    expectErr(
      await SdReportService.update(ADMIN, WS, 'rep1', {
        customerIds: ['other'],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates a database error of the labels after the update', async () => {
    data.findScopeLabels.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(
      await SdReportService.update(ADMIN, WS, 'rep1', { atTime: '08:30' }),
      'DATABASE_ERROR',
    )
  })

  it('propagates a database error of the update', async () => {
    reports.update.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(
      await SdReportService.update(ADMIN, WS, 'rep1', patch),
      'DATABASE_ERROR',
    )
  })
})

describe('remove()', () => {
  it('soft-deletes and audits', async () => {
    expectOk(await SdReportService.remove(ADMIN, WS, 'rep1'))

    expect(reports.softDelete).toHaveBeenCalledWith('rep1', WS)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete' }),
    )
  })

  it('404s an unknown schedule', async () => {
    reports.findById.mockResolvedValue({
      ok: false,
      error: { code: 'SD_CONFIG_NOT_FOUND', message: 'x' },
    } as never)

    expectErr(
      await SdReportService.remove(ADMIN, WS, 'nope'),
      'SD_REPORT_NOT_FOUND',
    )
  })

  it('refuses an agent', async () => {
    actAs('agent')

    expectErr(await SdReportService.remove('agent-1', WS, 'rep1'), 'FORBIDDEN')
  })
})

describe('runs()', () => {
  it('lists the history for an agent', async () => {
    actAs('agent')
    const rows = expectOk(
      await SdReportService.runs('agent-1', WS, { limit: 10 }),
    )

    expect(runs.list).toHaveBeenCalledWith(WS, { limit: 10 })
    expect(rows[0].reportName).toBe('SLA mensal')
  })

  it('defaults the limit', async () => {
    expectOk(await SdReportService.runs(ADMIN, WS))

    expect(runs.list).toHaveBeenCalledWith(WS, { limit: 50 })
  })

  it('checks the schedule when filtering by report', async () => {
    expectOk(
      await SdReportService.runs(ADMIN, WS, { reportId: 'rep1', limit: 5 }),
    )
    expect(reports.findById).toHaveBeenCalledWith('rep1', WS)

    reports.findById.mockResolvedValue({
      ok: false,
      error: { code: 'SD_CONFIG_NOT_FOUND', message: 'x' },
    } as never)
    expectErr(
      await SdReportService.runs(ADMIN, WS, { reportId: 'nope', limit: 5 }),
      'SD_REPORT_NOT_FOUND',
    )
  })

  it('refuses a requester', async () => {
    actAs('requester')

    expectErr(await SdReportService.runs('req-1', WS), 'SD_NOT_AGENT')
  })

  it('propagates a database error', async () => {
    runs.list.mockResolvedValue({
      ok: false,
      error: databaseError('boom'),
    } as never)

    expectErr(await SdReportService.runs(ADMIN, WS), 'DATABASE_ERROR')
  })
})

describe('generateNow()', () => {
  it('generates from a schedule and audits the manual run', async () => {
    expectOk(await SdReportService.generateNow(ADMIN, WS, { reportId: 'rep1' }))

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS,
        name: 'SLA mensal',
        period: 'LAST_MONTH',
        recipients: ['gestor@example.com'],
        requestedById: ADMIN,
        source: 'report.manual',
      }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'activate' }),
    )
  })

  it('generates on demand with the scope of the request', async () => {
    expectOk(
      await SdReportService.generateNow(ADMIN, WS, {
        period: 'LAST_30_DAYS',
        customerIds: ['cus1'],
        formats: ['CSV'],
        recipients: ['ops@example.com'],
      }),
    )

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        report: null,
        name: 'Relatório de SLA',
        period: 'LAST_30_DAYS',
        formats: ['CSV'],
        recipients: ['ops@example.com'],
        includeAccountOwners: false,
        scope: {
          customerIds: ['cus1'],
          departmentIds: [],
          ticketTypes: [],
        },
      }),
    )
  })

  it('uses the defaults of an empty on-demand request', async () => {
    expectOk(await SdReportService.generateNow(ADMIN, WS, {}))

    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        period: 'LAST_MONTH',
        formats: ['PDF', 'CSV'],
        recipients: [],
        timezone: 'America/Sao_Paulo',
      }),
    )
  })

  it('404s an unknown schedule and checks an on-demand scope', async () => {
    reports.findById.mockResolvedValue({
      ok: false,
      error: { code: 'SD_CONFIG_NOT_FOUND', message: 'x' },
    } as never)
    expectErr(
      await SdReportService.generateNow(ADMIN, WS, { reportId: 'nope' }),
      'SD_REPORT_NOT_FOUND',
    )

    data.findScopeLabels.mockResolvedValue(
      ok({ customers: [], departments: [] }),
    )
    expectErr(
      await SdReportService.generateNow(ADMIN, WS, { customerIds: ['other'] }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('refuses an agent', async () => {
    actAs('agent')

    expectErr(await SdReportService.generateNow('agent-1', WS, {}), 'FORBIDDEN')
    expect(generate).not.toHaveBeenCalled()
  })
})

describe('download()', () => {
  it('serves the PDF bytes of a run', async () => {
    const file = expectOk(
      await SdReportService.download(ADMIN, WS, 'run1', { format: 'PDF' }),
    )

    expect(file.contentType).toBe('application/pdf')
    expect(file.fileName).toBe('sla-mensal-2026-09-01.pdf')
    expect(file.body.toString()).toBe('%PDF-1.7')
  })

  it('serves the CSV and falls back on the run without a schedule', async () => {
    runs.findById.mockResolvedValue(
      ok(
        createFakeSdReportRun({
          report: null,
          csvKey: 'ws1/reports/run1.csv',
        }),
      ),
    )

    const file = expectOk(
      await SdReportService.download(ADMIN, WS, 'run1', { format: 'CSV' }),
    )

    expect(file.contentType).toBe('text/csv; charset=utf-8')
    expect(file.fileName).toBe('relatorio-sla-2026-09-01.csv')
  })

  it('defaults the format to PDF', async () => {
    expectOk(await SdReportService.download(ADMIN, WS, 'run1'))

    expect(storage).toHaveBeenCalledWith({
      bucket: 'servicedesk',
      key: 'ws1/reports/run1.pdf',
    })
  })

  it('404s an unknown run, a missing format and a storage failure', async () => {
    runs.findById.mockResolvedValue({
      ok: false,
      error: { code: 'SD_CONFIG_NOT_FOUND', message: 'x' },
    } as never)
    expectErr(
      await SdReportService.download(ADMIN, WS, 'nope'),
      'SD_REPORT_RUN_NOT_FOUND',
    )

    runs.findById.mockResolvedValue(ok(createFakeSdReportRun()))
    expectErr(
      await SdReportService.download(ADMIN, WS, 'run1', { format: 'CSV' }),
      'SD_REPORT_RUN_NOT_FOUND',
    )

    runs.findById.mockResolvedValue(
      ok(createFakeSdReportRun({ pdfKey: 'ws1/reports/run1.pdf' })),
    )
    storage.mockRejectedValue(new Error('MinIO fora do ar'))
    expectErr(
      await SdReportService.download(ADMIN, WS, 'run1'),
      'SD_REPORT_RUN_NOT_FOUND',
    )

    storage.mockRejectedValue('estranho')
    expectErr(
      await SdReportService.download(ADMIN, WS, 'run1'),
      'SD_REPORT_RUN_NOT_FOUND',
    )
  })

  it('refuses a requester', async () => {
    actAs('requester')

    expectErr(
      await SdReportService.download('req-1', WS, 'run1'),
      'SD_NOT_AGENT',
    )
  })
})
