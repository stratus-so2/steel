import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import {
  createFakeSdEscalation,
  createFakeSdTicket,
} from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-ticket.repository')
vi.mock('@/src/repositories/sd-ticket-escalation.repository')
vi.mock('@/lib/axiom/audit')
vi.mock('../sd-automation-engine', () => ({ runSdAutomations: vi.fn() }))
vi.mock('../sd-ticket-escalator', () => ({ escalateSdTicket: vi.fn() }))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn(), resolveRef: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdTicketEscalationRepository } from '@/src/repositories/sd-ticket-escalation.repository'
import { runSdAutomations } from '../sd-automation-engine'
import { SdTicketEngine } from '../sd-ticket-engine'
import { SdTicketEscalationService } from '../sd-ticket-escalation.service'
import { escalateSdTicket } from '../sd-ticket-escalator'

const config = {
  settings: createFakeSdSettings(),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
}
const engine = vi.mocked(SdTicketEngine)
const ticket = createFakeSdTicket({ id: 't1' })

function as(agent: boolean) {
  vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
  vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(
    ok(agent ? [{ departmentId: 'd', parentId: null, isLead: true }] : []),
  )
}

beforeEach(() => {
  as(true)
  engine.loadConfig.mockResolvedValue(ok(config))
  engine.resolveRef.mockResolvedValue(ok(ticket))
})

describe('SdTicketEscalationService.list', () => {
  it('requires an agent', async () => {
    as(false)
    expectErr(
      await SdTicketEscalationService.list('u', 'ws1', 't1'),
      'SD_NOT_AGENT',
    )
  })

  it('propagates errors and maps escalations', async () => {
    engine.resolveRef.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketEscalationService.list('u', 'ws1', 't1'))
    vi.mocked(SdTicketEscalationRepository.listByTicket).mockResolvedValueOnce(
      err(databaseError()),
    )
    expectErr(await SdTicketEscalationService.list('u', 'ws1', 't1'))
    vi.mocked(SdTicketEscalationRepository.listByTicket).mockResolvedValue(
      ok([createFakeSdEscalation({ id: 'e1' })]),
    )
    const list = expectOk(
      await SdTicketEscalationService.list('u', 'ws1', 't1'),
    )
    expect(list.map((e) => e.id)).toEqual(['e1'])
  })
})

describe('SdTicketEscalationService.escalate', () => {
  const dto = { kind: 'HIERARCHICAL' as const, reason: 'Travado' }

  it('guards access, config and ticket', async () => {
    as(false)
    expectErr(
      await SdTicketEscalationService.escalate('u', 'ws1', 't1', dto),
      'SD_NOT_AGENT',
    )
    as(true)
    engine.loadConfig.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketEscalationService.escalate('u', 'ws1', 't1', dto))
    engine.resolveRef.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketEscalationService.escalate('u', 'ws1', 't1', dto))
    vi.mocked(escalateSdTicket).mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketEscalationService.escalate('u', 'ws1', 't1', dto))
  })

  it('escalates, audits and reloads after matching automations', async () => {
    const after = createFakeSdTicket({ id: 't1', escalationLevel: 1 })
    vi.mocked(escalateSdTicket).mockResolvedValue(
      ok({ ticket: after, escalation: createFakeSdEscalation({ toLevel: 1 }) }),
    )
    vi.mocked(runSdAutomations).mockResolvedValue(ok({ matched: 1, rules: [] }))
    vi.mocked(SdTicketRepository.findById).mockResolvedValue(
      ok(createFakeSdTicket({ id: 't1', escalationLevel: 1, tags: ['auto'] })),
    )
    const out = expectOk(
      await SdTicketEscalationService.escalate('u', 'ws1', 't1', {
        kind: 'FUNCTIONAL',
        toDepartmentId: 'd2',
        reason: 'x',
      }),
    )
    expect(out.ticket.tags).toEqual(['auto'])
    expect(out.escalation.toLevel).toBe(1)
    expect(escalateSdTicket).toHaveBeenCalledWith(
      ticket,
      expect.objectContaining({
        kind: 'FUNCTIONAL',
        toDepartmentId: 'd2',
        notifyDepartmentLeads: false,
      }),
      expect.objectContaining({ kind: 'user', userId: 'u' }),
      config,
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'escalate', targetId: 't1' }),
    )
  })

  it('keeps the escalated ticket when reload fails or nothing matched', async () => {
    const after = createFakeSdTicket({ id: 't1', escalationLevel: 2 })
    vi.mocked(escalateSdTicket).mockResolvedValue(
      ok({ ticket: after, escalation: createFakeSdEscalation() }),
    )
    vi.mocked(runSdAutomations).mockResolvedValue(ok({ matched: 1, rules: [] }))
    vi.mocked(SdTicketRepository.findById).mockResolvedValue(
      err(databaseError()),
    )
    expect(
      expectOk(await SdTicketEscalationService.escalate('u', 'ws1', 't1', dto))
        .ticket.escalationLevel,
    ).toBe(2)
    vi.mocked(runSdAutomations).mockResolvedValue(err(databaseError()))
    expectOk(await SdTicketEscalationService.escalate('u', 'ws1', 't1', dto))
    vi.mocked(runSdAutomations).mockResolvedValue(ok({ matched: 0, rules: [] }))
    expectOk(await SdTicketEscalationService.escalate('u', 'ws1', 't1', dto))
    expect(SdTicketRepository.findById).toHaveBeenCalledTimes(1)
  })
})
