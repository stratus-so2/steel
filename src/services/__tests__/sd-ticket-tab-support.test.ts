import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import {
  createFakeSdTicket,
  createFakeSdUserSummary,
} from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/lib/servicedesk/realtime', () => ({
  publishSdTicketEvent: vi.fn(),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn(), resolveRef: vi.fn() },
}))

import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdTicketEngine } from '../sd-ticket-engine'
import {
  isSdTicketLocked,
  loadSdTicketTab,
  publishSdTicketTab,
  sdTabAuthorKind,
  sdTicketAudience,
} from '../sd-ticket-tab-support'

const engine = vi.mocked(SdTicketEngine)
const config = {
  settings: createFakeSdSettings(),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
}

function as(who: 'agent' | 'requester', role: Role = 'MEMBER') {
  vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
  vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(
    ok(
      who === 'agent'
        ? [{ departmentId: 'd1', parentId: null, isLead: false }]
        : [],
    ),
  )
}

const ticket = createFakeSdTicket({
  id: 't1',
  number: 42,
  requesterId: 'req',
})

beforeEach(() => {
  as('agent')
  engine.loadConfig.mockResolvedValue(ok(config))
  engine.resolveRef.mockResolvedValue(ok(ticket))
})

describe('loadSdTicketTab', () => {
  it('loads the scope for an agent with the ticket code', async () => {
    const scope = expectOk(await loadSdTicketTab('u1', 'ws1', 'INC-42', 'VIEW'))
    expect(scope.ticket).toBe(ticket)
    expect(scope.code).toBe('INC-000042')
    expect(scope.ctx.isAgent).toBe(true)
    expect(scope.actor).toMatchObject({ kind: 'user', userId: 'u1' })
    expect(engine.resolveRef).toHaveBeenCalledWith(
      'ws1',
      'INC-42',
      DEFAULT_SD_TICKET_PREFIXES,
    )
  })

  it('refuses non-members, disabled module and VIEWER mutations', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(null),
    )
    expectErr(await loadSdTicketTab('u1', 'ws1', 't1', 'VIEW'), 'FORBIDDEN')

    as('agent')
    vi.mocked(WorkspaceModuleAccessRepository.isEnabled).mockResolvedValueOnce(
      ok(false),
    )
    expectErr(
      await loadSdTicketTab('u1', 'ws1', 't1', 'VIEW'),
      'MODULE_DISABLED',
    )

    as('agent', 'VIEWER')
    expectOk(await loadSdTicketTab('u1', 'ws1', 't1', 'VIEW'))
    expectErr(await loadSdTicketTab('u1', 'ws1', 't1', 'CREATE'), 'FORBIDDEN')
    expect(engine.loadConfig).toHaveBeenCalledTimes(1)
  })

  it('refuses a suspended workspace', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ workspaceStatus: 'SUSPENDED' })),
    )
    expectErr(
      await loadSdTicketTab('u1', 'ws1', 't1', 'VIEW'),
      'WORKSPACE_SUSPENDED',
    )
  })

  it('agent-only tabs refuse requesters', async () => {
    as('requester')
    expectErr(
      await loadSdTicketTab('req', 'ws1', 't1', 'VIEW', { agentOnly: true }),
      'SD_NOT_AGENT',
    )
    expect(engine.loadConfig).not.toHaveBeenCalled()
  })

  it('requesters only reach tickets they are linked to', async () => {
    as('requester')
    expectOk(await loadSdTicketTab('req', 'ws1', 't1', 'VIEW'))
    expectErr(
      await loadSdTicketTab('other', 'ws1', 't1', 'VIEW'),
      'SD_TICKET_FORBIDDEN',
    )
    engine.resolveRef.mockResolvedValue(
      ok(
        createFakeSdTicket({
          participants: [
            { userId: 'guest', user: createFakeSdUserSummary({ id: 'guest' }) },
          ],
        }),
      ),
    )
    expectOk(await loadSdTicketTab('guest', 'ws1', 't1', 'VIEW'))
  })

  it('locks closed and canceled tickets when requireOpen', async () => {
    for (const category of ['CLOSED', 'CANCELED'] as const) {
      engine.resolveRef.mockResolvedValue(
        ok(createFakeSdTicket({ phase: { ...ticket.phase, category } })),
      )
      expectErr(
        await loadSdTicketTab('u1', 'ws1', 't1', 'EDIT', { requireOpen: true }),
        'SD_TICKET_CLOSED',
      )
      expectOk(await loadSdTicketTab('u1', 'ws1', 't1', 'VIEW'))
    }
  })

  it('propagates config, lookup and access errors', async () => {
    engine.resolveRef.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await loadSdTicketTab('u1', 'ws1', 'nope', 'VIEW'),
      'SD_TICKET_NOT_FOUND',
    )
    engine.loadConfig.mockResolvedValue(err(databaseError()))
    expectErr(
      await loadSdTicketTab('u1', 'ws1', 't1', 'VIEW'),
      'DATABASE_ERROR',
    )
    vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(
      err(databaseError()),
    )
    expectErr(
      await loadSdTicketTab('u1', 'ws1', 't1', 'VIEW'),
      'DATABASE_ERROR',
    )
  })
})

describe('helpers', () => {
  it('isSdTicketLocked only for CLOSED/CANCELED', () => {
    expect(isSdTicketLocked(ticket)).toBe(false)
    expect(
      isSdTicketLocked({ phase: { ...ticket.phase, category: 'RESOLVED' } }),
    ).toBe(false)
    expect(
      isSdTicketLocked({ phase: { ...ticket.phase, category: 'CLOSED' } }),
    ).toBe(true)
  })

  it('builds the realtime audience', () => {
    expect(
      sdTicketAudience(
        createFakeSdTicket({
          requesterId: 'r',
          participants: [
            { userId: 'p', user: createFakeSdUserSummary({ id: 'p' }) },
          ],
          contact: {
            id: 'c',
            name: 'Contato',
            email: null,
            phone: null,
            userId: 'cu',
          },
        }),
      ),
    ).toEqual({ requesterId: 'r', participantIds: ['p'], contactUserId: 'cu' })
    expect(sdTicketAudience(ticket).contactUserId).toBeNull()
  })

  it('publishes tab events, flagging internal ones', async () => {
    await publishSdTicketTab(ticket, 'ticket.task', 'u1', true)
    await publishSdTicketTab(ticket, 'ticket.message', null)
    const calls = vi.mocked(publishSdTicketEvent).mock.calls
    expect(calls[0]?.[0]).toBe('ws1')
    expect(calls[0]?.[1]).toMatchObject({
      type: 'ticket.task',
      ticketId: 't1',
      number: 42,
      actorId: 'u1',
      internal: true,
    })
    expect(calls[1]?.[1]).not.toHaveProperty('internal')
    expect(calls[1]?.[2]).toEqual({
      requesterId: 'req',
      participantIds: [],
      contactUserId: null,
    })
  })

  it('maps the author kind from the role', () => {
    expect(sdTabAuthorKind({ isAgent: true } as never)).toBe('AGENT')
    expect(sdTabAuthorKind({ isAgent: false } as never)).toBe('REQUESTER')
  })
})
