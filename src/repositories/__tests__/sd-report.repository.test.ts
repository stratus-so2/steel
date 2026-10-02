import { describe, expect, it } from 'vitest'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import {
  SD_REPORT_PERIOD_END,
  SD_REPORT_PERIOD_START,
  seedSdReportRun,
  seedSdScheduledReport,
} from '@/src/__tests__/factories/sd-report.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdDepartment,
  seedSdPhase,
  seedSdSettings,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  SdReportDataRepository,
  SdReportRunRepository,
  SdScheduledReportRepository,
} from '../sd-report.repository'

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('SdScheduledReportRepository', () => {
  it('creates a schedule with the defaults and scopes the list', async () => {
    const { workspace, other, user } = await setup()

    const created = expectOk(
      await SdScheduledReportRepository.create(workspace.id, {
        name: 'SLA mensal',
        createdById: user.id,
        customerIds: ['cus1'],
        recipients: ['gestor@example.com'],
        nextRunAt: new Date('2026-11-01T10:00:00.000Z'),
      }),
    )
    await seedSdScheduledReport(other.id, user.id)

    expect(created).toMatchObject({
      kind: 'SLA',
      period: 'LAST_MONTH',
      formats: ['PDF', 'CSV'],
      dayOfMonth: 1,
      atTime: '07:00',
      timezone: 'America/Sao_Paulo',
      includeAccountOwners: false,
      active: true,
      _count: { runs: 0 },
    })

    const rows = expectOk(await SdScheduledReportRepository.list(workspace.id))
    expect(rows.map((row) => row.id)).toEqual([created.id])
  })

  it('hides the inactive schedules unless asked', async () => {
    const { workspace, user } = await setup()
    const active = await seedSdScheduledReport(workspace.id, user.id, {
      name: 'Ativo',
    })
    const paused = await seedSdScheduledReport(workspace.id, user.id, {
      name: 'Pausado',
      active: false,
    })

    expect(
      expectOk(await SdScheduledReportRepository.list(workspace.id)).map(
        (row) => row.id,
      ),
    ).toEqual([active.id])
    expect(
      expectOk(
        await SdScheduledReportRepository.list(workspace.id, {
          includeInactive: true,
        }),
      ).map((row) => row.id),
    ).toEqual([active.id, paused.id])
  })

  it('finds, updates and soft-deletes', async () => {
    const { workspace, other, user } = await setup()
    const report = await seedSdScheduledReport(workspace.id, user.id)

    expectOk(
      await SdScheduledReportRepository.findById(report.id, workspace.id),
    )
    expectErr(
      await SdScheduledReportRepository.findById(report.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )

    const updated = expectOk(
      await SdScheduledReportRepository.update(report.id, workspace.id, {
        atTime: '08:30',
        formats: ['CSV'],
        nextRunAt: null,
      }),
    )
    expect(updated).toMatchObject({ atTime: '08:30', formats: ['CSV'] })

    expectOk(
      await SdScheduledReportRepository.softDelete(report.id, workspace.id),
    )
    expectErr(
      await SdScheduledReportRepository.findById(report.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
    const row = await prisma.sdScheduledReport.findUnique({
      where: { id: report.id },
    })
    expect(row).toMatchObject({ active: false, nextRunAt: null })
    expect(row?.deletedAt).not.toBeNull()
  })

  it('refuses to update a schedule of another workspace', async () => {
    const { workspace, other, user } = await setup()
    const report = await seedSdScheduledReport(workspace.id, user.id)

    expectErr(
      await SdScheduledReportRepository.update(report.id, other.id, {
        atTime: '09:00',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('lists only the active and due schedules, oldest first', async () => {
    const { workspace, user } = await setup()
    const late = await seedSdScheduledReport(workspace.id, user.id, {
      name: 'Atrasado',
      nextRunAt: new Date('2026-10-01T09:00:00.000Z'),
    })
    const due = await seedSdScheduledReport(workspace.id, user.id, {
      name: 'Vencido',
      nextRunAt: new Date('2026-10-01T10:00:00.000Z'),
    })
    await seedSdScheduledReport(workspace.id, user.id, {
      name: 'Futuro',
      nextRunAt: new Date('2026-12-01T10:00:00.000Z'),
    })
    await seedSdScheduledReport(workspace.id, user.id, {
      name: 'Pausado',
      active: false,
      nextRunAt: new Date('2026-10-01T08:00:00.000Z'),
    })
    await seedSdScheduledReport(workspace.id, user.id, {
      name: 'Sem agenda',
      nextRunAt: null,
    })

    const rows = expectOk(
      await SdScheduledReportRepository.listDue(
        new Date('2026-10-01T12:00:00.000Z'),
        10,
      ),
    )

    expect(rows.map((row) => row.id)).toEqual([late.id, due.id])
  })
})

describe('SdReportRunRepository', () => {
  it('records a run, lists the history and finds it by period', async () => {
    const { workspace, other, user } = await setup()
    const report = await seedSdScheduledReport(workspace.id, user.id)

    const created = expectOk(
      await SdReportRunRepository.create({
        workspaceId: workspace.id,
        reportId: report.id,
        status: 'GENERATED',
        periodStart: SD_REPORT_PERIOD_START,
        periodEnd: SD_REPORT_PERIOD_END,
        summary: { volume: { opened: 3 } },
        recipients: ['gestor@example.com'],
        requestedById: user.id,
      }),
    )

    expect(created).toMatchObject({
      status: 'GENERATED',
      report: { id: report.id, name: report.name },
      requestedBy: { id: user.id },
    })

    await seedSdReportRun(other.id)
    const onDemand = await seedSdReportRun(workspace.id, {
      status: 'FAILED',
      error: 'MinIO fora do ar',
    })

    const all = expectOk(
      await SdReportRunRepository.list(workspace.id, { limit: 10 }),
    )
    expect(all.map((row) => row.id).sort()).toEqual(
      [created.id, onDemand.id].sort(),
    )

    const filtered = expectOk(
      await SdReportRunRepository.list(workspace.id, {
        reportId: report.id,
        limit: 10,
      }),
    )
    expect(filtered.map((row) => row.id)).toEqual([created.id])

    const samePeriod = expectOk(
      await SdReportRunRepository.findByPeriod(
        report.id,
        SD_REPORT_PERIOD_START,
      ),
    )
    expect(samePeriod?.id).toBe(created.id)

    const otherPeriod = expectOk(
      await SdReportRunRepository.findByPeriod(
        report.id,
        new Date('2026-08-01T03:00:00.000Z'),
      ),
    )
    expect(otherPeriod).toBeNull()
  })

  it('returns the existing run when the same period is created twice', async () => {
    const { workspace, user } = await setup()
    const report = await seedSdScheduledReport(workspace.id, user.id)
    const payload = {
      workspaceId: workspace.id,
      reportId: report.id,
      status: 'GENERATED' as const,
      periodStart: SD_REPORT_PERIOD_START,
      periodEnd: SD_REPORT_PERIOD_END,
      recipients: ['gestor@example.com'],
    }

    const first = expectOk(await SdReportRunRepository.create(payload))
    // A trava é do banco (índice único): a segunda tentativa do mesmo período
    // devolve a execução que já existe em vez de duplicar o envio.
    const second = expectOk(await SdReportRunRepository.create(payload))

    expect(second.id).toBe(first.id)

    const all = expectOk(
      await SdReportRunRepository.list(workspace.id, { limit: 10 }),
    )
    expect(all).toHaveLength(1)
  })

  it('keeps on-demand runs out of the idempotency lock', async () => {
    const { workspace } = await setup()
    const payload = {
      workspaceId: workspace.id,
      reportId: null,
      status: 'GENERATED' as const,
      periodStart: SD_REPORT_PERIOD_START,
      periodEnd: SD_REPORT_PERIOD_END,
    }

    // `reportId` nulo não conflita em índice único no Postgres: relatório
    // pontual pode ser gerado quantas vezes o agente quiser.
    const first = expectOk(await SdReportRunRepository.create(payload))
    const second = expectOk(await SdReportRunRepository.create(payload))

    expect(second.id).not.toBe(first.id)
  })

  it('updates the keys and the delivery, and scopes the read', async () => {
    const { workspace, other } = await setup()
    const run = await seedSdReportRun(workspace.id)

    const stored = expectOk(
      await SdReportRunRepository.update(run.id, {
        pdfKey: `${workspace.id}/reports/${run.id}.pdf`,
        status: 'SENT',
        sentAt: new Date('2026-10-01T10:05:00.000Z'),
      }),
    )
    expect(stored).toMatchObject({ status: 'SENT' })
    expect(stored.pdfKey).toContain('/reports/')

    expectOk(await SdReportRunRepository.findById(run.id, workspace.id))
    expectErr(
      await SdReportRunRepository.findById(run.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('turns a missing run into SD_CONFIG_NOT_FOUND on update', async () => {
    expectErr(
      await SdReportRunRepository.update('nope', { status: 'SENT' }),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdReportDataRepository', () => {
  it('collects the tickets that touch the period, honouring the scope', async () => {
    const { workspace, user } = await setup()
    await seedSdSettings(workspace.id)
    const phase = await seedSdPhase(workspace.id)
    const department = await seedSdDepartment(workspace.id, { name: 'Infra' })
    const customer = await seedSdCustomer(workspace.id, user.id, {
      name: 'ACME',
    })
    const otherCustomer = await seedSdCustomer(workspace.id, user.id, {
      name: 'Beta',
    })

    const inPeriod = await seedSdTicket(workspace.id, phase.id, {
      title: 'Aberto no período',
      createdAt: new Date('2026-09-10T12:00:00.000Z'),
      resolvedAt: new Date('2026-09-11T12:00:00.000Z'),
      customerId: customer.id,
      departmentId: department.id,
    })
    const stillOpen = await seedSdTicket(workspace.id, phase.id, {
      title: 'Ainda aberto',
      createdAt: new Date('2026-08-01T12:00:00.000Z'),
      customerId: customer.id,
    })
    await seedSdTicket(workspace.id, phase.id, {
      title: 'Resolvido antes do período',
      createdAt: new Date('2026-07-01T12:00:00.000Z'),
      resolvedAt: new Date('2026-07-02T12:00:00.000Z'),
      closedAt: new Date('2026-07-02T12:00:00.000Z'),
      customerId: customer.id,
    })
    await seedSdTicket(workspace.id, phase.id, {
      title: 'Aberto depois do período',
      createdAt: new Date('2026-10-10T12:00:00.000Z'),
      customerId: customer.id,
    })
    await seedSdTicket(workspace.id, phase.id, {
      title: 'Outro cliente',
      createdAt: new Date('2026-09-12T12:00:00.000Z'),
      customerId: otherCustomer.id,
    })
    const deleted = await seedSdTicket(workspace.id, phase.id, {
      title: 'Excluído',
      createdAt: new Date('2026-09-13T12:00:00.000Z'),
      customerId: customer.id,
      deletedAt: new Date('2026-09-14T12:00:00.000Z'),
    })

    const rows = expectOk(
      await SdReportDataRepository.collectTickets(
        workspace.id,
        {
          customerIds: [customer.id],
          departmentIds: [],
          ticketTypes: ['INCIDENT'],
        },
        SD_REPORT_PERIOD_START,
        SD_REPORT_PERIOD_END,
        100,
      ),
    )

    expect(rows.map((row) => row.id).sort()).toEqual(
      [inPeriod.id, stillOpen.id].sort(),
    )
    expect(rows.map((row) => row.id)).not.toContain(deleted.id)
    const withDepartment = rows.find((row) => row.id === inPeriod.id)
    expect(withDepartment?.department?.name).toBe('Infra')
    expect(withDepartment?.customer?.name).toBe('ACME')

    const byDepartment = expectOk(
      await SdReportDataRepository.collectTickets(
        workspace.id,
        { customerIds: [], departmentIds: [department.id], ticketTypes: [] },
        SD_REPORT_PERIOD_START,
        SD_REPORT_PERIOD_END,
        100,
      ),
    )
    expect(byDepartment.map((row) => row.id)).toEqual([inPeriod.id])
  })

  it('reads the default calendar, the context and the scope labels', async () => {
    const { workspace, user } = await setup()
    await seedSdSettings(workspace.id, { ticketPrefixes: { INCIDENT: 'OCO' } })
    const department = await seedSdDepartment(workspace.id, { name: 'Infra' })
    const customer = await seedSdCustomer(workspace.id, user.id, {
      name: 'ACME',
    })
    await prisma.sdBusinessCalendar.create({
      data: {
        workspaceId: workspace.id,
        name: 'Comercial',
        schedule: { mon: [['09:00', '18:00']] },
        isDefault: true,
      },
    })

    const calendar = expectOk(
      await SdReportDataRepository.findDefaultCalendar(workspace.id),
    )
    expect(calendar).toMatchObject({ timezone: 'America/Sao_Paulo' })

    const context = expectOk(
      await SdReportDataRepository.findContext(workspace.id),
    )
    expect(context).toMatchObject({
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      ticketPrefixes: { INCIDENT: 'OCO' },
    })

    const labels = expectOk(
      await SdReportDataRepository.findScopeLabels(workspace.id, {
        customerIds: [customer.id, 'ghost'],
        departmentIds: [department.id],
      }),
    )
    expect(labels.customers).toEqual([{ id: customer.id, name: 'ACME' }])
    expect(labels.departments).toEqual([{ id: department.id, name: 'Infra' }])

    const empty = expectOk(
      await SdReportDataRepository.findScopeLabels(workspace.id, {
        customerIds: [],
        departmentIds: [],
      }),
    )
    expect(empty).toEqual({ customers: [], departments: [] })
  })

  it('has no context for an unknown workspace and no calendar by default', async () => {
    const { workspace } = await setup()

    expect(
      expectOk(await SdReportDataRepository.findContext('nope')),
    ).toBeNull()
    expect(
      expectOk(await SdReportDataRepository.findDefaultCalendar(workspace.id)),
    ).toBeNull()
    // Sem SdSettings os prefixos vêm nulos (o mapper cai no padrão).
    const context = expectOk(
      await SdReportDataRepository.findContext(workspace.id),
    )
    expect(context?.ticketPrefixes).toBeNull()
  })

  it('reads the account owners of the scope', async () => {
    const { workspace, user } = await setup()
    const customer = await seedSdCustomer(workspace.id, user.id, {
      name: 'ACME',
      email: 'contato@acme.com',
    })

    const contacts = expectOk(
      await SdReportDataRepository.findCustomerContacts(workspace.id, [
        customer.id,
      ]),
    )

    expect(contacts).toEqual([
      {
        id: customer.id,
        name: 'ACME',
        email: 'contato@acme.com',
        ownerEmail: user.email,
        ownerName: user.name,
      },
    ])

    expect(
      expectOk(
        await SdReportDataRepository.findCustomerContacts(workspace.id, []),
      ),
    ).toEqual([])
  })
})
