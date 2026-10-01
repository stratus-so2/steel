import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  createFakeSdPhase,
  createFakeSdSettings,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdPhaseNotFound, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/sd-ticket.repository', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/src/repositories/sd-ticket.repository')
  >()),
  SdTicketRepository: {
    list: vi.fn(),
    kanban: vi.fn(),
    summary: vi.fn(),
    findById: vi.fn(),
    softDelete: vi.fn(),
  },
}))
vi.mock('@/src/lib/servicedesk/realtime', () => ({
  publishSdTicketEvent: vi.fn(),
}))
vi.mock('@/lib/axiom/audit')
vi.mock('../sd-automation-engine', () => ({ runSdAutomations: vi.fn() }))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: {
    loadConfig: vi.fn(),
    resolveRef: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    changePhase: vi.fn(),
  },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { ListSdTicketsSchema } from '@/src/schemas/sd-ticket.schema'
import { runSdAutomations } from '../sd-automation-engine'
import { SdTicketService } from '../sd-ticket.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'

const engine = vi.mocked(SdTicketEngine)
const repo = vi.mocked(SdTicketRepository)
const automations = vi.mocked(runSdAutomations)
const settings = createFakeSdSettings()
const config = { settings, prefixes: DEFAULT_SD_TICKET_PREFIXES }
const q = (input: Record<string, unknown> = {}) =>
  ListSdTicketsSchema.parse(input)

type Who = 'agent' | 'requester' | 'admin'
function as(who: Who, role: Role = 'MEMBER') {
  vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: who === 'admin' ? 'OWNER' : role })),
  )
  vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(
    ok(
      who === 'agent'
        ? [{ departmentId: 'd1', parentId: null, isLead: false }]
        : [],
    ),
  )
}

const ticket = (o: Partial<SdTicketWithRelations> = {}) =>
  createFakeSdTicket({ id: 't1', requesterId: 'u1', ...o })

beforeEach(() => {
  as('agent')
  engine.loadConfig.mockResolvedValue(ok(config))
  engine.resolveRef.mockResolvedValue(ok(ticket()))
  automations.mockResolvedValue(ok({ matched: 0, rules: [] }))
})

describe('authorization gates', () => {
  it('non-member → FORBIDDEN', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(null),
    )
    expectErr(await SdTicketService.list('u1', 'ws1', q()), 'FORBIDDEN')
  })

  it('module disabled → MODULE_DISABLED', async () => {
    vi.mocked(WorkspaceModuleAccessRepository.isEnabled).mockResolvedValueOnce(
      ok(false),
    )
    expectErr(await SdTicketService.get('u1', 'ws1', 't1'), 'MODULE_DISABLED')
  })

  it('VIEWER cannot create', async () => {
    as('agent', 'VIEWER')
    expectErr(
      await SdTicketService.create('u1', 'ws1', {
        type: 'INCIDENT',
        title: 'x',
      }),
      'FORBIDDEN',
    )
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('propagates config errors', async () => {
    engine.loadConfig.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketService.list('u1', 'ws1', q()), 'DATABASE_ERROR')
  })
})

describe('list', () => {
  it('resolves filters (me, unassigned, none, code search) for agents', async () => {
    repo.list.mockResolvedValue(
      ok({ items: [ticket()], total: 1, nextCursor: 'c' }),
    )
    const page = expectOk(
      await SdTicketService.list(
        'u1',
        'ws1',
        q({
          type: 'INCIDENT',
          assigneeIds: 'me,unassigned,u9',
          requesterId: 'me',
          parentId: 'none',
          q: 'INC-000042',
          page: '2',
          pageSize: '10',
        }),
      ),
    )
    expect(page).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      nextCursor: 'c',
    })
    expect(page.items[0].code).toBe('INC-000001')
    const where = repo.list.mock.calls[0][0].where
    const json = JSON.stringify(where)
    expect(where).toMatchObject({
      workspaceId: 'ws1',
      type: { in: ['INCIDENT'] },
    })
    expect(json).toContain('"assigneeId":{"in":["u1","u9"]}')
    expect(json).toContain('"assigneeId":null')
    expect(json).toContain('"number":42')
    expect(where).toMatchObject({ requesterId: 'u1', parentId: null })
    expect(json).not.toContain('participants')
  })

  it('resolves the participant filter (me or explicit id)', async () => {
    repo.list.mockResolvedValue(ok({ items: [], total: 0, nextCursor: null }))
    expectOk(
      await SdTicketService.list('u1', 'ws1', q({ participantId: 'me' })),
    )
    expectOk(
      await SdTicketService.list('u1', 'ws1', q({ participantId: 'u7' })),
    )
    expect(JSON.stringify(repo.list.mock.calls[0][0].where)).toContain(
      '"participants":{"some":{"userId":"u1"}}',
    )
    expect(JSON.stringify(repo.list.mock.calls[1][0].where)).toContain(
      '"participants":{"some":{"userId":"u7"}}',
    )
  })

  it('scopes requesters, keeps explicit parents and uses cursor pages', async () => {
    as('requester')
    repo.list.mockResolvedValue(ok({ items: [], total: 0, nextCursor: null }))
    const page = expectOk(
      await SdTicketService.list(
        'u1',
        'ws1',
        q({
          types: 'CHANGE',
          parentId: 'p1',
          q: 'impressora',
          cursor: 'x',
          page: '3',
        }),
      ),
    )
    expect(page.page).toBe(1)
    const where = repo.list.mock.calls[0][0].where
    expect(where.parentId).toBe('p1')
    expect(JSON.stringify(where)).toContain('participants')
    expect(JSON.stringify(where)).not.toContain('"number"')
    expect(repo.list.mock.calls[0][0].cursor).toBe('x')
  })

  it('propagates repository errors', async () => {
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketService.list('u1', 'ws1', q()), 'DATABASE_ERROR')
  })
})

describe('kanban', () => {
  const phases = [
    createFakeSdPhase({ id: 'p1', name: 'Novo' }),
    createFakeSdPhase({ id: 'p2', name: 'Fechado', category: 'CLOSED' }),
  ]

  it('requires a type', async () => {
    expectErr(
      await SdTicketService.kanban('u1', 'ws1', q()),
      'VALIDATION_ERROR',
    )
  })

  it('propagates access, phase and repository errors', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(null),
    )
    expectErr(
      await SdTicketService.kanban('u1', 'ws1', q({ type: 'INCIDENT' })),
    )
    as('agent')
    vi.mocked(SdTicketContextRepository.listPhases).mockResolvedValue(
      err(databaseError()),
    )
    expectErr(
      await SdTicketService.kanban('u1', 'ws1', q({ type: 'INCIDENT' })),
    )
    vi.mocked(SdTicketContextRepository.listPhases).mockResolvedValue(
      ok(phases),
    )
    repo.kanban.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketService.kanban('u1', 'ws1', q({ type: 'INCIDENT' })),
    )
  })

  it('builds one column per phase (all, or the requested subset)', async () => {
    vi.mocked(SdTicketContextRepository.listPhases).mockResolvedValue(
      ok(phases),
    )
    repo.kanban.mockResolvedValue(
      ok([
        { phaseId: 'p1', count: 3, items: [ticket()] },
        { phaseId: 'p2', count: 0, items: [] },
      ]),
    )
    const board = expectOk(
      await SdTicketService.kanban(
        'u1',
        'ws1',
        q({ types: 'INCIDENT', columnLimit: '5' }),
      ),
    )
    expect(board.type).toBe('INCIDENT')
    expect(
      board.columns.map((c) => [c.phase.name, c.count, c.items.length]),
    ).toEqual([
      ['Novo', 3, 1],
      ['Fechado', 0, 0],
    ])
    expect(repo.kanban).toHaveBeenCalledWith(
      expect.objectContaining({ phaseIds: ['p1', 'p2'], take: 5 }),
    )
    // fases finais aparecem: o filtro de "abertos" não se aplica ao quadro
    expect(JSON.stringify(repo.kanban.mock.calls[0][0].where)).not.toContain(
      'notIn',
    )

    repo.kanban.mockResolvedValue(ok([{ phaseId: 'p2', count: 1, items: [] }]))
    const subset = expectOk(
      await SdTicketService.kanban(
        'u1',
        'ws1',
        q({ type: 'INCIDENT', phaseIds: 'p2' }),
      ),
    )
    expect(subset.columns.map((c) => c.phase.id)).toEqual(['p2'])
  })
})

describe('summary', () => {
  const summary = {
    byPhaseCategory: {
      NEW: 1,
      IN_PROGRESS: 0,
      WAITING: 0,
      RESOLVED: 0,
      CLOSED: 0,
      CANCELED: 0,
    },
    myOpen: 1,
    unassigned: 0,
    atRisk: 0,
    breached: 0,
    createdToday: 1,
  }

  it('agents see everything, requesters their own', async () => {
    repo.summary.mockResolvedValue(ok(summary))
    expect(expectOk(await SdTicketService.summary('u1', 'ws1'))).toEqual(
      summary,
    )
    expect(repo.summary.mock.calls[0][0].scope).toBeUndefined()
    as('requester')
    await SdTicketService.summary('u1', 'ws1')
    expect(repo.summary.mock.calls[1][0].scope).toBeDefined()
    expect(repo.summary.mock.calls[1][0].todayStart).toBeInstanceOf(Date)
  })

  it('propagates access errors', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(null),
    )
    expectErr(await SdTicketService.summary('u1', 'ws1'), 'FORBIDDEN')
  })
})

describe('get', () => {
  it('returns the ticket for agents (with AI) and requesters (without)', async () => {
    engine.resolveRef.mockResolvedValue(ok(ticket({ aiSummary: 'x' })))
    expect(
      expectOk(await SdTicketService.get('u9', 'ws1', 'INC-1')).aiSummary,
    ).toBe('x')
    as('requester')
    expect(
      expectOk(await SdTicketService.get('u1', 'ws1', 'INC-1')).aiSummary,
    ).toBeNull()
  })

  it('forbids requesters on tickets they are not part of; propagates not found', async () => {
    as('requester')
    expectErr(
      await SdTicketService.get('u2', 'ws1', 't1'),
      'SD_TICKET_FORBIDDEN',
    )
    engine.resolveRef.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdTicketService.get('u1', 'ws1', 't1'),
      'SD_TICKET_NOT_FOUND',
    )
  })
})

describe('create', () => {
  it('agent: passes the full input with AGENT channel, audits and runs automations', async () => {
    engine.create.mockResolvedValue(ok(ticket()))
    automations.mockResolvedValue(ok({ matched: 1, rules: [] }))
    repo.findById.mockResolvedValue(ok(ticket({ tags: ['auto'] })))
    const dto = expectOk(
      await SdTicketService.create('u1', 'ws1', {
        type: 'INCIDENT',
        title: 'x',
        priorityId: 'p',
      }),
    )
    expect(dto.tags).toEqual(['auto'])
    expect(engine.create).toHaveBeenCalledWith(
      'ws1',
      { type: 'INCIDENT', title: 'x', priorityId: 'p', channel: 'AGENT' },
      expect.objectContaining({ kind: 'user', isAgent: true }),
      config,
    )
    expect(automations).toHaveBeenCalledWith('TICKET_CREATED', 't1', {
      actorId: 'u1',
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', targetId: 't1' }),
    )
  })

  it('agent: keeps an explicit channel; reload failure keeps the created ticket', async () => {
    engine.create.mockResolvedValue(ok(ticket({ title: 'orig' })))
    automations.mockResolvedValue(ok({ matched: 1, rules: [] }))
    repo.findById.mockResolvedValue(err(databaseError()))
    const dto = expectOk(
      await SdTicketService.create('u1', 'ws1', {
        type: 'INCIDENT',
        title: 'x',
        channel: 'PHONE',
      }),
    )
    expect(dto.title).toBe('orig')
    expect(engine.create.mock.calls[0][1].channel).toBe('PHONE')
  })

  it('requester: portal channel, limited fields, own requester', async () => {
    as('requester')
    engine.create.mockResolvedValue(ok(ticket()))
    expectOk(
      await SdTicketService.create('u1', 'ws1', {
        type: 'INCIDENT',
        title: 'x',
        description: '<p>d</p>',
        assigneeId: 'hacker',
        priorityId: 'p1',
        urgencyId: 'u',
      }),
    )
    expect(engine.create.mock.calls[0][1]).toEqual({
      type: 'INCIDENT',
      title: 'x',
      description: '<p>d</p>',
      urgencyId: 'u',
      channel: 'PORTAL',
      requesterId: 'u1',
      portal: true,
    })
  })

  it('requester: portal disabled or type not allowed', async () => {
    as('requester')
    engine.loadConfig.mockResolvedValue(
      ok({
        ...config,
        settings: createFakeSdSettings({ portalEnabled: false }),
      }),
    )
    expectErr(
      await SdTicketService.create('u1', 'ws1', {
        type: 'INCIDENT',
        title: 'x',
      }),
      'SD_PORTAL_DISABLED',
    )
    engine.loadConfig.mockResolvedValue(ok(config))
    expectErr(
      await SdTicketService.create('u1', 'ws1', { type: 'CHANGE', title: 'x' }),
      'SD_TICKET_FORBIDDEN',
    )
  })

  it('audits failures', async () => {
    engine.create.mockResolvedValue(err(sdPhaseNotFound()))
    expectErr(
      await SdTicketService.create('u1', 'ws1', {
        type: 'INCIDENT',
        title: 'x',
      }),
      'SD_PHASE_NOT_FOUND',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        reason: 'SD_PHASE_NOT_FOUND',
      }),
    )
  })
})

describe('update', () => {
  it('requester restrictions', async () => {
    as('requester')
    expectErr(
      await SdTicketService.update('u1', 'ws1', 't1', { priorityId: 'p' }),
      'SD_TICKET_FORBIDDEN',
    )
    expectErr(
      await SdTicketService.update('u1', 'ws1', 't1', { csatScore: 5 }),
      'VALIDATION_ERROR',
    )
    engine.resolveRef.mockResolvedValue(
      ok(ticket({ phase: { ...ticket().phase, category: 'RESOLVED' } })),
    )
    engine.update.mockImplementation(async (t) => ok(t))
    expectOk(
      await SdTicketService.update('u1', 'ws1', 't1', {
        csatScore: 5,
        csatComment: 'ótimo',
        title: undefined,
      }),
    )
    engine.resolveRef.mockResolvedValue(
      ok(ticket({ phase: { ...ticket().phase, category: 'CLOSED' } })),
    )
    expectOk(await SdTicketService.update('u1', 'ws1', 't1', { csatScore: 4 }))
    engine.resolveRef.mockResolvedValue(ok(ticket()))
    expectOk(await SdTicketService.update('u1', 'ws1', 't1', { title: 'novo' }))
  })

  it('agents cannot rate the service', async () => {
    expectErr(
      await SdTicketService.update('u1', 'ws1', 't1', { csatScore: 5 }),
      'SD_TICKET_FORBIDDEN',
    )
  })

  it('no-op update skips automations; changes run them and reload', async () => {
    const t = ticket()
    engine.resolveRef.mockResolvedValue(ok(t))
    engine.update.mockResolvedValueOnce(ok(t))
    expectOk(await SdTicketService.update('u9', 'ws1', 't1', { title: 'x' }))
    expect(automations).not.toHaveBeenCalled()

    engine.update.mockResolvedValueOnce(ok(ticket({ title: 'y' })))
    automations.mockResolvedValue(ok({ matched: 1, rules: [] }))
    repo.findById.mockResolvedValue(ok(ticket({ title: 'z' })))
    expect(
      expectOk(await SdTicketService.update('u9', 'ws1', 't1', { title: 'y' }))
        .title,
    ).toBe('z')
    expect(automations).toHaveBeenCalledWith('TICKET_UPDATED', 't1', {
      actorId: 'u9',
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        meta: { workspaceId: 'ws1', fields: ['title'] },
      }),
    )
  })

  it('propagates engine and access errors', async () => {
    engine.update.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketService.update('u9', 'ws1', 't1', { title: 'y' }))
    engine.resolveRef.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(await SdTicketService.update('u9', 'ws1', 't1', { title: 'y' }))
  })
})

describe('movePhase', () => {
  it('requesters cannot move', async () => {
    as('requester')
    expectErr(
      await SdTicketService.movePhase('u1', 'ws1', 't1', { phaseId: 'p2' }),
      'SD_NOT_AGENT',
    )
  })

  it('no-op, success with automations, and errors', async () => {
    const t = ticket()
    engine.resolveRef.mockResolvedValue(ok(t))
    engine.changePhase.mockResolvedValueOnce(ok(t))
    expectOk(
      await SdTicketService.movePhase('u9', 'ws1', 't1', {
        phaseId: t.phaseId,
      }),
    )
    expect(automations).not.toHaveBeenCalled()

    engine.changePhase.mockResolvedValueOnce(ok(ticket({ phaseId: 'p2' })))
    expect(
      expectOk(
        await SdTicketService.movePhase('u9', 'ws1', 't1', {
          phaseId: 'p2',
          solution: 's',
          comment: 'c',
        }),
      ).phaseId,
    ).toBe('p2')
    expect(engine.changePhase).toHaveBeenLastCalledWith(
      t,
      'p2',
      expect.any(Object),
      config,
      { solution: 's', solutionClassificationId: undefined, comment: 'c' },
    )
    expect(automations).toHaveBeenCalledWith('PHASE_CHANGED', 't1', {
      actorId: 'u9',
    })

    engine.changePhase.mockResolvedValueOnce(err(sdPhaseNotFound()))
    expectErr(
      await SdTicketService.movePhase('u9', 'ws1', 't1', { phaseId: 'x' }),
    )
    engine.resolveRef.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdTicketService.movePhase('u9', 'ws1', 't1', { phaseId: 'x' }),
    )
  })
})

describe('bulkUpdate', () => {
  it('requesters cannot bulk update; access errors propagate', async () => {
    as('requester')
    expectErr(
      await SdTicketService.bulkUpdate('u1', 'ws1', {
        ids: ['a'],
        assigneeId: 'x',
      }),
      'SD_NOT_AGENT',
    )
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(null),
    )
    expectErr(
      await SdTicketService.bulkUpdate('u1', 'ws1', {
        ids: ['a'],
        assigneeId: 'x',
      }),
      'FORBIDDEN',
    )
  })

  it('updates each ticket, collecting partial failures', async () => {
    const a = ticket({ id: 'a' })
    const b = ticket({ id: 'b' })
    const c = ticket({ id: 'c' })
    const d = ticket({ id: 'd' })
    repo.findById.mockImplementation(async (id) => {
      if (id === 'missing') return err(sdTicketNotFound())
      return ok({ a, b, c, d }[id as 'a'])
    })
    engine.update.mockImplementation(async (t) => {
      if (t.id === 'b') return err(databaseError())
      if (t.id === 'c') return ok(t) // sem mudança
      return ok({ ...t, assigneeId: 'x' })
    })
    engine.changePhase.mockImplementation(async (t) => {
      if (t.id === 'd') return err(sdPhaseNotFound())
      if (t.id === 'c') return ok(t)
      return ok({ ...t, phaseId: 'p2' })
    })
    automations.mockResolvedValue(ok({ matched: 0, rules: [] }))

    const result = expectOk(
      await SdTicketService.bulkUpdate('u9', 'ws1', {
        ids: ['a', 'a', 'b', 'c', 'd', 'missing'],
        assigneeId: 'x',
        departmentId: null,
        priorityId: 'p',
        phaseId: 'p2',
      }),
    )
    expect(result.updated).toEqual(['a', 'c'])
    expect(result.failed.map((f) => [f.id, f.code])).toEqual([
      ['b', 'DATABASE_ERROR'],
      ['d', 'SD_PHASE_NOT_FOUND'],
      ['missing', 'SD_TICKET_NOT_FOUND'],
    ])
    expect(engine.update).toHaveBeenCalledWith(
      a,
      { assigneeId: 'x', departmentId: null, priorityId: 'p' },
      expect.any(Object),
      config,
    )
    expect(automations).toHaveBeenCalledWith('PHASE_CHANGED', 'a', {
      actorId: 'u9',
    })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          op: 'bulk',
          fields: ['assigneeId', 'departmentId', 'priorityId', 'phaseId'],
        }),
      }),
    )
  })

  it('works without a phase change', async () => {
    repo.findById.mockResolvedValue(ok(ticket({ id: 'a' })))
    engine.update.mockImplementation(async (t) => ok({ ...t }))
    const result = expectOk(
      await SdTicketService.bulkUpdate('u9', 'ws1', {
        ids: ['a'],
        priorityId: 'p',
      }),
    )
    expect(result.updated).toEqual(['a'])
    expect(engine.changePhase).not.toHaveBeenCalled()
  })
})

describe('setParent', () => {
  it('requesters cannot; access errors propagate', async () => {
    as('requester')
    expectErr(
      await SdTicketService.setParent('u1', 'ws1', 't1', { parentId: null }),
      'SD_NOT_AGENT',
    )
    engine.resolveRef.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdTicketService.setParent('u1', 'ws1', 't1', { parentId: null }),
    )
  })

  it('resolves the parent by code and updates', async () => {
    const t = ticket()
    engine.resolveRef
      .mockResolvedValueOnce(ok(t))
      .mockResolvedValueOnce(ok(ticket({ id: 'parent' })))
    engine.update.mockResolvedValue(ok(ticket({ parentId: 'parent' })))
    expectOk(
      await SdTicketService.setParent('u9', 'ws1', 't1', {
        parentId: 'PRB-000001',
      }),
    )
    expect(engine.update).toHaveBeenCalledWith(
      t,
      { parentId: 'parent' },
      expect.any(Object),
      config,
      { allowClosed: true },
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ op: 'parent' }),
      }),
    )
  })

  it('clears the parent; propagates parent lookup and engine errors', async () => {
    engine.update.mockResolvedValue(ok(ticket()))
    expectOk(
      await SdTicketService.setParent('u9', 'ws1', 't1', { parentId: null }),
    )
    expect(engine.update.mock.calls[0][1]).toEqual({ parentId: null })

    engine.resolveRef
      .mockResolvedValueOnce(ok(ticket()))
      .mockResolvedValueOnce(err(sdTicketNotFound()))
    expectErr(
      await SdTicketService.setParent('u9', 'ws1', 't1', { parentId: 'x' }),
      'SD_TICKET_NOT_FOUND',
    )
    engine.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketService.setParent('u9', 'ws1', 't1', { parentId: null }),
    )
  })
})

describe('remove', () => {
  it('only admins delete', async () => {
    expectErr(await SdTicketService.remove('u9', 'ws1', 't1'), 'FORBIDDEN')
    // perfil com DELETE em chamados, mas sem ser admin do módulo
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(
        createFakeMembership({
          role: 'MEMBER',
          profile: createFakeProfile({
            permissions: { 'sd-tickets': ['VIEW', 'DELETE'] },
          }),
        }),
      ),
    )
    const denied = expectErr(
      await SdTicketService.remove('u9', 'ws1', 't1'),
      'FORBIDDEN',
    )
    expect(denied.message).toBe(
      'Apenas administradores do ServiceDesk excluem chamados',
    )
    expect(repo.softDelete).not.toHaveBeenCalled()
  })

  it('soft-deletes, records, audits and publishes', async () => {
    as('admin')
    repo.softDelete.mockResolvedValue(ok(undefined))
    expectOk(await SdTicketService.remove('u9', 'ws1', 't1'))
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ticket.deleted' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', targetId: 't1' }),
    )
    expect(publishSdTicketEvent).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ type: 'ticket.deleted' }),
      expect.objectContaining({ requesterId: 'u1', contactUserId: null }),
    )
    engine.resolveRef.mockResolvedValue(
      ok(
        ticket({
          contact: {
            id: 'c',
            name: 'C',
            email: null,
            phone: null,
            userId: 'cu',
          },
          participants: [
            {
              userId: 'p',
              user: { id: 'p', name: 'P', email: 'p@x', image: null },
            },
          ],
        }),
      ),
    )
    expectOk(await SdTicketService.remove('u9', 'ws1', 't1'))
    expect(publishSdTicketEvent).toHaveBeenLastCalledWith(
      'ws1',
      expect.any(Object),
      expect.objectContaining({ contactUserId: 'cu', participantIds: ['p'] }),
    )
  })

  it('propagates errors', async () => {
    as('admin')
    repo.softDelete.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketService.remove('u9', 'ws1', 't1'))
    engine.resolveRef.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(await SdTicketService.remove('u9', 'ws1', 't1'))
  })
})
