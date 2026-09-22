import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import {
  createFakeSdTicket,
  createFakeSdUserSummary,
} from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-ticket.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/sd-ticket-participant.repository')
vi.mock('@/src/lib/servicedesk/realtime', () => ({
  publishSdTicketEvent: vi.fn(),
}))
vi.mock('@/lib/axiom/audit')
vi.mock('../sd-ticket-event-recorder', () => ({
  recordSdTicketEvent: vi.fn(),
  sdEventActorKind: (a: { kind: string; isAgent?: boolean }) =>
    a.kind === 'system' ? 'SYSTEM' : a.isAgent ? 'AGENT' : 'REQUESTER',
}))
vi.mock('../sd-ticket-notifier', () => ({
  SdTicketNotifier: { notify: vi.fn() },
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn(), resolveRef: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketParticipantRepository } from '@/src/repositories/sd-ticket-participant.repository'
import { SdTicketEngine, sdSystemActor } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { SdTicketNotifier } from '../sd-ticket-notifier'
import {
  addSdTicketParticipant,
  SdTicketParticipantService,
} from '../sd-ticket-participant.service'

const config = {
  settings: createFakeSdSettings(),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
}
const ctxRepo = vi.mocked(SdTicketContextRepository)
const partRepo = vi.mocked(SdTicketParticipantRepository)
const ticketRepo = vi.mocked(SdTicketRepository)
const engine = vi.mocked(SdTicketEngine)
const guest = createFakeSdUserSummary({ id: 'g', name: 'Convidado' })
const withGuest = createFakeSdTicket({
  id: 't1',
  requesterId: 'r',
  participants: [{ userId: 'g', user: guest }],
})

function as(userId: 'agent' | 'requester' | 'other', role: Role = 'MEMBER') {
  vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
  vi.mocked(SdAccessRepository).listDepartmentLinks.mockResolvedValue(
    ok(
      userId === 'agent'
        ? [{ departmentId: 'd', parentId: null, isLead: false }]
        : [],
    ),
  )
}

beforeEach(() => {
  engine.loadConfig.mockResolvedValue(ok(config))
  engine.resolveRef.mockResolvedValue(
    ok(createFakeSdTicket({ id: 't1', requesterId: 'r' })),
  )
  ctxRepo.findNonMembers.mockResolvedValue(ok([]))
  partRepo.add.mockResolvedValue(ok(true))
  partRepo.remove.mockResolvedValue(ok(true))
  ticketRepo.findById.mockResolvedValue(ok(withGuest))
})

describe('addSdTicketParticipant', () => {
  const t = createFakeSdTicket({ id: 't1', number: 5 })

  it('rejects non-members and propagates errors', async () => {
    ctxRepo.findNonMembers.mockResolvedValue(ok(['g']))
    expectErr(
      await addSdTicketParticipant(t, 'g', sdSystemActor('x'), config),
      'VALIDATION_ERROR',
    )
    ctxRepo.findNonMembers.mockResolvedValue(err(databaseError()))
    expectErr(await addSdTicketParticipant(t, 'g', sdSystemActor('x'), config))
    ctxRepo.findNonMembers.mockResolvedValue(ok([]))
    partRepo.add.mockResolvedValue(err(databaseError()))
    expectErr(await addSdTicketParticipant(t, 'g', sdSystemActor('x'), config))
    partRepo.add.mockResolvedValue(ok(true))
    ticketRepo.findById.mockResolvedValue(err(databaseError()))
    expectErr(await addSdTicketParticipant(t, 'g', sdSystemActor('x'), config))
  })

  it('is a no-op when already a participant', async () => {
    partRepo.add.mockResolvedValue(ok(false))
    expect(
      expectOk(
        await addSdTicketParticipant(t, 'g', sdSystemActor('x'), config),
      ),
    ).toBe(t)
    expect(recordSdTicketEvent).not.toHaveBeenCalled()
  })

  it('records, notifies and publishes', async () => {
    const out = expectOk(
      await addSdTicketParticipant(t, 'g', sdSystemActor('x'), config),
    )
    expect(out).toBe(withGuest)
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'participant.added',
        actorKind: 'SYSTEM',
        toValue: { id: 'g', label: 'Convidado' },
      }),
    )
    expect(SdTicketNotifier.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: ['g'], kind: 'SD_TICKET_MESSAGE' }),
    )
    expect(publishSdTicketEvent).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ type: 'ticket.participants', actorId: null }),
      expect.objectContaining({ participantIds: ['g'] }),
    )
  })

  it('labels with the id when the user is not in the refreshed ticket', async () => {
    ticketRepo.findById.mockResolvedValue(ok(createFakeSdTicket()))
    await addSdTicketParticipant(t, 'zz', sdSystemActor('x'), config)
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ toValue: { id: 'zz', label: 'zz' } }),
    )
  })
})

describe('SdTicketParticipantService', () => {
  it('list: access, config, ticket and visibility errors', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(null),
    )
    expectErr(
      await SdTicketParticipantService.list('x', 'ws1', 't1'),
      'FORBIDDEN',
    )
    as('agent')
    engine.loadConfig.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketParticipantService.list('a', 'ws1', 't1'))
    engine.loadConfig.mockResolvedValue(ok(config))
    engine.resolveRef.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketParticipantService.list('a', 'ws1', 't1'))
    engine.resolveRef.mockResolvedValue(
      ok(createFakeSdTicket({ requesterId: 'r' })),
    )
    as('other')
    expectErr(
      await SdTicketParticipantService.list('x', 'ws1', 't1'),
      'SD_TICKET_FORBIDDEN',
    )
  })

  it('list returns participant summaries', async () => {
    as('agent')
    engine.resolveRef.mockResolvedValue(ok(withGuest))
    expect(
      expectOk(await SdTicketParticipantService.list('a', 'ws1', 't1')),
    ).toEqual([guest])
  })

  it('add: requester of the ticket or agent only', async () => {
    as('requester')
    engine.resolveRef.mockResolvedValue(
      ok(
        createFakeSdTicket({
          requesterId: 'r',
          participants: [
            { userId: 'p', user: createFakeSdUserSummary({ id: 'p' }) },
          ],
        }),
      ),
    )
    expectErr(
      await SdTicketParticipantService.add('p', 'ws1', 't1', 'g'),
      'SD_TICKET_FORBIDDEN',
    )
    expect(
      expectOk(await SdTicketParticipantService.add('r', 'ws1', 't1', 'g')),
    ).toEqual([guest])
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket',
        meta: expect.objectContaining({ op: 'participant_add' }),
      }),
    )
  })

  it('add propagates core errors', async () => {
    as('agent')
    ctxRepo.findNonMembers.mockResolvedValue(ok(['g']))
    expectErr(await SdTicketParticipantService.add('a', 'ws1', 't1', 'g'))
    expectErr(
      await (async () => {
        as('agent')
        return SdTicketParticipantService.add('a', 'ws1', 't1', 'g')
      })(),
      'VALIDATION_ERROR',
    )
  })

  it('add denies without EDIT permission', async () => {
    as('agent', 'VIEWER')
    expectErr(
      await SdTicketParticipantService.add('a', 'ws1', 't1', 'g'),
      'FORBIDDEN',
    )
  })

  it('remove: permission rules', async () => {
    as('requester')
    engine.resolveRef.mockResolvedValue(ok(withGuest))
    expectErr(
      await SdTicketParticipantService.remove('x', 'ws1', 't1', 'g'),
      'SD_TICKET_FORBIDDEN',
    )
    // outro participante não remove terceiros
    engine.resolveRef.mockResolvedValueOnce(
      ok(
        createFakeSdTicket({
          requesterId: 'r',
          participants: [
            { userId: 'g', user: guest },
            { userId: 'p2', user: createFakeSdUserSummary({ id: 'p2' }) },
          ],
        }),
      ),
    )
    const denied = expectErr(
      await SdTicketParticipantService.remove('p2', 'ws1', 't1', 'g'),
      'SD_TICKET_FORBIDDEN',
    )
    expect(denied.message).toBe('Você não pode remover este participante')
    // o próprio participante pode sair
    ticketRepo.findById.mockResolvedValue(ok(createFakeSdTicket({ id: 't1' })))
    expect(
      expectOk(await SdTicketParticipantService.remove('g', 'ws1', 't1', 'g')),
    ).toEqual([])
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'participant.removed',
        actorKind: 'REQUESTER',
        fromValue: { id: 'g', label: 'Convidado' },
      }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ op: 'participant_remove' }),
      }),
    )
  })

  it('remove: not linked, errors and label fallback', async () => {
    as('agent')
    engine.resolveRef.mockResolvedValue(ok(withGuest))
    partRepo.remove.mockResolvedValue(ok(false))
    expect(
      expectOk(await SdTicketParticipantService.remove('a', 'ws1', 't1', 'g')),
    ).toEqual([guest])
    partRepo.remove.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketParticipantService.remove('a', 'ws1', 't1', 'g'))
    partRepo.remove.mockResolvedValue(ok(true))
    ticketRepo.findById.mockResolvedValue(err(databaseError()))
    expectErr(await SdTicketParticipantService.remove('a', 'ws1', 't1', 'zz'))
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ fromValue: { id: 'zz', label: 'zz' } }),
    )
  })

  it('remove propagates access errors', async () => {
    vi.mocked(MembershipRepository).findByUserAndWorkspace.mockResolvedValue(
      ok(null),
    )
    expectErr(
      await SdTicketParticipantService.remove('a', 'ws1', 't1', 'g'),
      'FORBIDDEN',
    )
  })
})
