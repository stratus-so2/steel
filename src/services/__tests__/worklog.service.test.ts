import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/workspace-module-access.repository')
vi.mock('@/src/repositories/productivity.repository')
vi.mock('@/src/repositories/worklog.repository', () => ({
  WorklogRepository: {
    listPage: vi.fn(),
    listBatch: vi.fn(),
    totals: vi.fn(),
    members: vi.fn(),
    defaultCalendar: vi.fn(),
    ticketPrefixes: vi.fn(),
  },
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { ModuleKind, SdBusinessCalendar } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { ProductivityRepository } from '@/src/repositories/productivity.repository'
import {
  type WorklogEntryRow,
  WorklogRepository,
} from '@/src/repositories/worklog.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  STANDARD_CALENDAR,
  WORKLOG_EXPORT_BATCH,
  WorklogService,
} from '../worklog.service'

const membershipRepo = vi.mocked(MembershipRepository)
const moduleRepo = vi.mocked(WorkspaceModuleAccessRepository)
const repo = vi.mocked(WorklogRepository)
const facts = vi.mocked(ProductivityRepository)
const audit = vi.mocked(auditMutation)

const ACTOR = 'u_ana'
const WS = 'ws_1'
const NOW = new Date('2026-10-08T15:00:00.000Z')
const sp = (local: string) => new Date(`${local}:00.000-03:00`)

const ANA = { id: ACTOR, name: 'Ana', email: 'ana@x.com', image: null }
const BRUNO = {
  id: 'u_bruno',
  name: 'Bruno',
  email: 'bruno@x.com',
  image: null,
}

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  membershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role, userId: ACTOR, workspaceId: WS })),
  )
}

function modules(...enabled: ModuleKind[]) {
  moduleRepo.listByWorkspace.mockResolvedValue(
    ok(
      (['SERVICE_DESK', 'CRM', 'COMMUNICATION'] as ModuleKind[]).map(
        (module) => ({
          id: module,
          workspaceId: WS,
          module,
          enabled: enabled.includes(module),
          grantedById: ACTOR,
          createdAt: NOW,
          updatedAt: NOW,
        }),
      ),
    ),
  )
}

function entry(id: string, overrides: Partial<WorklogEntryRow> = {}) {
  return {
    id,
    startedAt: sp('2026-10-06T09:00'),
    endedAt: sp('2026-10-06T10:30'),
    minutes: 90,
    billable: true,
    source: 'TIMER',
    amount: new Prisma.Decimal('150'),
    description: 'Ajuste no roteador',
    user: ANA,
    ticket: { id: 't1', number: 42, type: 'INCIDENT', title: 'Sem internet' },
    ...overrides,
  } as WorklogEntryRow
}

function calendar(overrides: Partial<SdBusinessCalendar> = {}) {
  return {
    id: 'cal1',
    workspaceId: WS,
    name: 'Comercial Recife',
    timezone: 'America/Recife',
    schedule: { mon: [['09:00', '18:00']] },
    holidays: [],
    is24x7: false,
    isDefault: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as SdBusinessCalendar
}

async function collect(chunks: AsyncGenerator<string>): Promise<string> {
  let out = ''
  for await (const chunk of chunks) out += chunk
  return out
}

beforeEach(() => {
  vi.clearAllMocks()
  asRole('ADMIN')
  modules('SERVICE_DESK', 'CRM', 'COMMUNICATION')
  repo.defaultCalendar.mockResolvedValue(ok(null))
  repo.ticketPrefixes.mockResolvedValue(ok({ INCIDENT: 'CHM' }))
  repo.members.mockResolvedValue(ok([ANA, BRUNO]))
  repo.listPage.mockResolvedValue(ok({ rows: [entry('e1')], total: 1 }))
  repo.totals.mockResolvedValue(
    ok({
      entries: 1,
      minutes: 90,
      billableMinutes: 90,
      timerMinutes: 60,
      amount: '150.00',
    }),
  )
  facts.timeEntries.mockResolvedValue(
    ok([
      {
        userId: ACTOR,
        startedAt: sp('2026-10-06T09:00'),
        minutes: 90,
        billable: true,
        source: 'TIMER',
        amount: '150.00',
      },
    ]),
  )
  facts.resolvedTickets.mockResolvedValue(ok([]))
  facts.completedTasks.mockResolvedValue(
    ok([{ assigneeId: 'u_bruno', completedAt: sp('2026-10-07T10:00') }]),
  )
  facts.wonOpportunities.mockResolvedValue(ok([]))
  facts.conversationsHandled.mockResolvedValue(ok([]))
})

describe('WorklogService.list', () => {
  it('lists everyone for an admin with filters, totals and the people filter', async () => {
    const dto = expectOk(
      await WorklogService.list(
        ACTOR,
        WS,
        {
          period: 'last_7_days',
          ticket: 'CHM-000042',
          billable: 'false',
          source: 'MANUAL',
          page: 2,
          pageSize: 10,
        },
        NOW,
      ),
    )
    expect(repo.listPage).toHaveBeenCalledWith(
      {
        workspaceId: WS,
        from: new Date('2026-10-02T03:00:00.000Z'),
        to: new Date('2026-10-09T03:00:00.000Z'),
        userId: undefined,
        ticket: { number: 42, type: 'INCIDENT' },
        billable: false,
        source: 'MANUAL',
      },
      { skip: 10, take: 10 },
    )
    expect(dto.period).toEqual({
      from: '2026-10-02',
      to: '2026-10-08',
      timezone: 'America/Sao_Paulo',
    })
    expect(dto.items[0].ticket.code).toBe('CHM-000042')
    expect(dto.items[0].amount).toBe('150.00')
    expect(dto.totals).toMatchObject({
      nonBillableMinutes: 0,
      manualMinutes: 30,
    })
    expect(dto.people).toEqual([ANA, BRUNO])
    expect(dto.canViewTeam).toBe(true)
    expect(dto.serviceDeskEnabled).toBe(true)
  })

  it('lets an admin filter one person and keeps "billable" when asked', async () => {
    expectOk(
      await WorklogService.list(
        ACTOR,
        WS,
        {
          period: 'last_30_days',
          userId: 'u_bruno',
          billable: 'true',
          page: 1,
          pageSize: 50,
        },
        NOW,
      ),
    )
    expect(repo.listPage.mock.calls[0][0]).toMatchObject({
      userId: 'u_bruno',
      billable: true,
    })
  })

  it('shows a member only their own entries', async () => {
    asRole('MEMBER')
    const dto = expectOk(
      await WorklogService.list(
        ACTOR,
        WS,
        { period: 'last_30_days', page: 1, pageSize: 50 },
        NOW,
      ),
    )
    expect(repo.listPage.mock.calls[0][0].userId).toBe(ACTOR)
    expect(dto.people).toBeNull()
    expect(dto.canViewTeam).toBe(false)
    expect(repo.members).not.toHaveBeenCalled()

    expectOk(
      await WorklogService.list(
        ACTOR,
        WS,
        { period: 'last_30_days', userId: ACTOR, page: 1, pageSize: 50 },
        NOW,
      ),
    )
  })

  it("refuses another person's entries to a member", async () => {
    asRole('MEMBER')
    const error = expectErr(
      await WorklogService.list(
        ACTOR,
        WS,
        { period: 'last_30_days', userId: 'u_bruno', page: 1, pageSize: 50 },
        NOW,
      ),
      'FORBIDDEN',
    )
    expect(error.message).toContain('Só o dono e os administradores')
    expect(repo.listPage).not.toHaveBeenCalled()
  })

  it('denies non-members', async () => {
    membershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await WorklogService.list(ACTOR, WS, {
        period: 'last_7_days',
        page: 1,
        pageSize: 50,
      }),
      'FORBIDDEN',
    )
  })

  it('rejects an unreadable ticket code', async () => {
    expectErr(
      await WorklogService.list(
        ACTOR,
        WS,
        { period: 'last_7_days', ticket: 'XYZ-1', page: 1, pageSize: 50 },
        NOW,
      ),
      'VALIDATION_ERROR',
    )
  })

  it('returns an empty page when the ServiceDesk is off', async () => {
    modules('CRM')
    const dto = expectOk(
      await WorklogService.list(
        ACTOR,
        WS,
        { period: 'last_7_days', page: 1, pageSize: 50 },
        NOW,
      ),
    )
    expect(dto.serviceDeskEnabled).toBe(false)
    expect(dto.items).toEqual([])
    expect(dto.total).toBe(0)
    expect(repo.listPage).not.toHaveBeenCalled()
  })

  it('uses the time zone of a usable workspace calendar', async () => {
    repo.defaultCalendar.mockResolvedValue(ok(calendar()))
    const dto = expectOk(
      await WorklogService.list(
        ACTOR,
        WS,
        { period: 'last_7_days', page: 1, pageSize: 50 },
        NOW,
      ),
    )
    expect(dto.period.timezone).toBe('America/Recife')
  })

  it('propagates repository failures', async () => {
    const run = () =>
      WorklogService.list(
        ACTOR,
        WS,
        { period: 'last_7_days', page: 1, pageSize: 50 },
        NOW,
      )
    moduleRepo.listByWorkspace.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
    repo.defaultCalendar.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
    repo.ticketPrefixes.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
    repo.members.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
    repo.listPage.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
    repo.totals.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
  })

  it('uses the current time by default', async () => {
    expectOk(
      await WorklogService.list(ACTOR, WS, {
        period: 'last_7_days',
        page: 1,
        pageSize: 50,
      }),
    )
  })
})

describe('WorklogService.exportCsv', () => {
  it('streams the header and every batch, then audits', async () => {
    const full = Array.from({ length: WORKLOG_EXPORT_BATCH }, (_, i) =>
      entry(`e${i}`),
    )
    repo.listBatch.mockResolvedValueOnce(ok(full)).mockResolvedValueOnce(
      ok([
        entry('last', {
          amount: null,
          endedAt: null,
          billable: false,
          source: 'MANUAL',
        }),
      ]),
    )

    const csv = expectOk(
      await WorklogService.exportCsv(ACTOR, WS, { period: 'last_7_days' }, NOW),
    )
    expect(csv.filename).toBe('registros-de-trabalho-2026-10-02_2026-10-08.csv')
    const text = await collect(csv.chunks)
    const lines = text.replace('﻿', '').trim().split('\r\n')
    expect(lines[0]).toBe(
      'inicio,fim,minutos,horas,pessoa,email,chamado,titulo_chamado,faturavel,origem,valor,descricao',
    )
    expect(lines[1]).toBe(
      '2026-10-06 09:00,2026-10-06 10:30,90,1.5,Ana,ana@x.com,CHM-000042,Sem internet,sim,cronômetro,150.00,Ajuste no roteador',
    )
    expect(lines).toHaveLength(WORKLOG_EXPORT_BATCH + 2)
    expect(lines.at(-1)).toContain(',não,manual,,')
    expect(repo.listBatch).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      WORKLOG_EXPORT_BATCH,
      `e${WORKLOG_EXPORT_BATCH - 1}`,
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'worklog',
        action: 'download',
        meta: expect.objectContaining({ scope: 'team' }),
      }),
    )
  })

  it('stops on an empty batch and audits a personal export', async () => {
    asRole('MEMBER')
    repo.listBatch.mockResolvedValueOnce(ok([]))
    const csv = expectOk(
      await WorklogService.exportCsv(ACTOR, WS, { period: 'last_7_days' }, NOW),
    )
    const text = await collect(csv.chunks)
    expect(text.trim().split('\r\n')).toHaveLength(1)
    expect(audit.mock.calls[0][0].meta).toMatchObject({ scope: 'person' })
  })

  it('aborts the stream when a batch fails', async () => {
    repo.listBatch.mockResolvedValueOnce(err(databaseError('db down')))
    const csv = expectOk(
      await WorklogService.exportCsv(ACTOR, WS, { period: 'last_7_days' }, NOW),
    )
    await expect(collect(csv.chunks)).rejects.toThrow('db down')
  })

  it('needs the ServiceDesk and the same authorization as the list', async () => {
    modules('CRM')
    expectErr(
      await WorklogService.exportCsv(ACTOR, WS, { period: 'last_7_days' }, NOW),
      'MODULE_DISABLED',
    )
    asRole('MEMBER')
    expectErr(
      await WorklogService.exportCsv(
        ACTOR,
        WS,
        { period: 'last_7_days', userId: 'u_bruno' },
        NOW,
      ),
      'FORBIDDEN',
    )
  })

  it('uses the current time by default', async () => {
    repo.listBatch.mockResolvedValueOnce(ok([]))
    expectOk(
      await WorklogService.exportCsv(ACTOR, WS, { period: 'last_7_days' }),
    )
  })
})

describe('WorklogService.productivity', () => {
  it('gives an admin the team plus every person, alphabetically', async () => {
    repo.members.mockResolvedValue(ok([ANA, BRUNO]))
    const dto = expectOk(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    // One query per source over previous + current period, everyone.
    expect(facts.timeEntries).toHaveBeenCalledWith(
      WS,
      {
        from: new Date('2026-09-25T03:00:00.000Z'),
        to: new Date('2026-10-09T03:00:00.000Z'),
      },
      undefined,
    )
    expect(dto.period).toEqual({
      from: '2026-10-02',
      to: '2026-10-08',
      timezone: 'America/Sao_Paulo',
      previousFrom: '2026-09-25',
      previousTo: '2026-10-01',
    })
    expect(dto.calendar).toEqual({
      source: 'standard',
      name: 'Padrão (seg–sex, 8 h por dia)',
    })
    expect(dto.team?.people).toBe(2)
    expect(dto.team?.current.serviceDesk?.loggedMinutes).toBe(90)
    expect(dto.team?.current.crm?.tasksCompleted).toBe(1)
    expect(dto.people.map((p) => p.user.name)).toEqual(['Ana', 'Bruno'])
    expect(dto.people[0].current.serviceDesk?.loggedMinutes).toBe(90)
    expect(dto.people[1].current.crm?.tasksCompleted).toBe(1)
    expect(dto.people[1].current.serviceDesk?.loggedMinutes).toBe(0)
    expect(dto.trend.length).toBeGreaterThan(0)
    expect(dto.canViewTeam).toBe(true)
  })

  it('narrows an admin to one person without the team row', async () => {
    const dto = expectOk(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days', userId: 'u_bruno' },
        NOW,
      ),
    )
    expect(dto.team).toBeNull()
    expect(dto.people.map((p) => p.user.id)).toEqual(['u_bruno'])
    expect(facts.completedTasks.mock.calls[0][2]).toBe('u_bruno')
  })

  it('shows a member only their own indicators', async () => {
    asRole('MEMBER')
    const dto = expectOk(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    expect(dto.team).toBeNull()
    expect(dto.canViewTeam).toBe(false)
    expect(dto.people.map((p) => p.user.id)).toEqual([ACTOR])
    expect(facts.timeEntries.mock.calls[0][2]).toBe(ACTOR)

    expectErr(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days', userId: 'u_bruno' },
        NOW,
      ),
      'FORBIDDEN',
    )
  })

  it('only queries and returns the enabled modules', async () => {
    modules('COMMUNICATION')
    repo.defaultCalendar.mockResolvedValue(ok(calendar({ is24x7: true })))
    const dto = expectOk(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    expect(dto.modules).toEqual({
      serviceDesk: false,
      crm: false,
      communication: true,
    })
    expect(dto.calendar.source).toBe('standard')
    expect(facts.timeEntries).not.toHaveBeenCalled()
    expect(facts.completedTasks).not.toHaveBeenCalled()
    expect(dto.team?.current.serviceDesk).toBeNull()
    expect(dto.team?.current.communication).toEqual({ conversationsHandled: 0 })
  })

  it('skips the WhatsApp source when Comunicação is off', async () => {
    modules('SERVICE_DESK', 'CRM')
    const dto = expectOk(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    expect(facts.conversationsHandled).not.toHaveBeenCalled()
    expect(dto.team?.current.communication).toBeNull()
    expect(dto.team?.current.crm).not.toBeNull()
  })

  it('names a usable workspace calendar', async () => {
    repo.defaultCalendar.mockResolvedValue(ok(calendar()))
    const dto = expectOk(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    expect(dto.calendar).toEqual({
      source: 'workspace',
      name: 'Comercial Recife',
    })
    expect(dto.period.timezone).toBe('America/Recife')
  })

  it('treats a calendar without business hours as missing', async () => {
    repo.defaultCalendar.mockResolvedValue(ok(calendar({ schedule: {} })))
    const dto = expectOk(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    expect(dto.calendar.source).toBe('standard')
    expect(dto.period.timezone).toBe(STANDARD_CALENDAR.timezone)
  })

  it('rejects a person who is not a member', async () => {
    expectErr(
      await WorklogService.productivity(
        ACTOR,
        WS,
        { period: 'last_7_days', userId: 'u_ghost' },
        NOW,
      ),
      'VALIDATION_ERROR',
    )
  })

  it('propagates failures of every source', async () => {
    const run = () =>
      WorklogService.productivity(ACTOR, WS, { period: 'last_7_days' }, NOW)
    for (const source of [
      facts.timeEntries,
      facts.resolvedTickets,
      facts.completedTasks,
      facts.wonOpportunities,
      facts.conversationsHandled,
    ]) {
      source.mockResolvedValueOnce(err(databaseError('x')))
      expectErr(await run(), 'DATABASE_ERROR')
    }
    repo.members.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
    moduleRepo.listByWorkspace.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await run(), 'DATABASE_ERROR')
    membershipRepo.findByUserAndWorkspace.mockResolvedValueOnce(ok(null))
    expectErr(await run(), 'FORBIDDEN')
  })

  it('uses the current time by default', async () => {
    expectOk(
      await WorklogService.productivity(ACTOR, WS, { period: 'last_7_days' }),
    )
  })
})

describe('WorklogService.productivityCsv', () => {
  it('writes the team and each person, current and previous, and audits', async () => {
    const csv = expectOk(
      await WorklogService.productivityCsv(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    expect(csv.filename).toBe('produtividade-2026-10-02_2026-10-08.csv')
    const lines = csv.content.replace('﻿', '').trim().split('\r\n')
    expect(
      lines[0].startsWith('pessoa,email,periodo,de,ate,horas_registradas'),
    ).toBe(true)
    expect(lines[0]).toContain('conversas_atendidas')
    expect(lines).toHaveLength(1 + 2 * 3)
    expect(
      lines[1].startsWith('Equipe,,atual,2026-10-02,2026-10-08,1.5,'),
    ).toBe(true)
    expect(lines[2]).toContain('anterior,2026-09-25,2026-10-01')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'worklog',
        action: 'export_requested',
        meta: expect.objectContaining({
          report: 'productivity',
          scope: 'team',
        }),
      }),
    )
  })

  it('audits a personal export and propagates errors', async () => {
    asRole('MEMBER')
    expectOk(
      await WorklogService.productivityCsv(
        ACTOR,
        WS,
        { period: 'last_7_days' },
        NOW,
      ),
    )
    expect(audit.mock.calls[0][0].meta).toMatchObject({ scope: 'person' })
    expectErr(
      await WorklogService.productivityCsv(ACTOR, WS, {
        period: 'last_7_days',
        userId: 'u_bruno',
      }),
      'FORBIDDEN',
    )
  })
})
