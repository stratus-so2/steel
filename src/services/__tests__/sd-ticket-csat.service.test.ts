import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-ticket-csat.repository')
vi.mock('@/src/services/sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn(), resolveRef: vi.fn() },
}))
vi.mock('@/src/services/sd-notification.service', () => ({
  notifySdEvent: vi.fn(async () => ({ ok: true, value: {} })),
}))
vi.mock('@/src/services/sd-ticket-event-recorder', () => ({
  recordSdTicketEvent: vi.fn(async () => ok(1)),
}))
vi.mock('@/src/lib/servicedesk/realtime', () => ({
  publishSdTicketEvent: vi.fn(async () => undefined),
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { SdTicketCsatRepository } from '@/src/repositories/sd-ticket-csat.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { SdTicketCsatService } from '../sd-ticket-csat.service'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'

const engine = vi.mocked(SdTicketEngine)
const repo = vi.mocked(SdTicketCsatRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const WS = 'ws1'

function resolved(overrides?: Partial<SdTicketWithRelations>) {
  const base = createFakeSdTicket({
    id: 't1',
    number: 12,
    requesterId: 'u1',
    participants: [
      {
        userId: 'u9',
        user: { id: 'u9', name: 'P', email: 'p@x', image: null },
      },
    ],
    ...overrides,
  })
  return {
    ...base,
    phase: {
      ...base.phase,
      category: overrides?.phase?.category ?? 'RESOLVED',
    },
  }
}

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  engine.loadConfig.mockResolvedValue(
    ok({
      settings: createFakeSdSettings(),
      prefixes: DEFAULT_SD_TICKET_PREFIXES,
    }),
  )
  repo.submit.mockResolvedValue(ok(true))
})

describe('SdTicketCsatService.submit', () => {
  it('records the requester rating with event, realtime and audit', async () => {
    actAs('requester')
    engine.resolveRef.mockResolvedValue(ok(resolved()))

    const dto = expectOk(
      await SdTicketCsatService.submit('u1', WS, 'INC-000012', {
        score: 5,
        comment: 'Rápido!',
      }),
    )

    expect(dto).toEqual({
      ticketId: 't1',
      number: 12,
      csatScore: 5,
      csatComment: 'Rápido!',
    })
    expect(engine.resolveRef).toHaveBeenCalledWith(
      WS,
      'INC-000012',
      DEFAULT_SD_TICKET_PREFIXES,
    )
    expect(repo.submit).toHaveBeenCalledWith('t1', WS, 5, 'Rápido!')
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'csat.submitted',
        actorKind: 'REQUESTER',
        toValue: 5,
        meta: { hasComment: true },
      }),
    )
    expect(publishSdTicketEvent).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ type: 'ticket.updated', ticketId: 't1' }),
      expect.objectContaining({ requesterId: 'u1', participantIds: ['u9'] }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket_csat',
        targetId: 't1',
        meta: { workspaceId: WS, score: 5 },
      }),
    )
  })

  it('accepts the linked contact user and a closed ticket without comment', async () => {
    actAs('requester')
    engine.resolveRef.mockResolvedValue(
      ok(
        resolved({
          requesterId: null,
          contact: {
            id: 'c1',
            name: 'Contato',
            email: null,
            phone: null,
            userId: 'u1',
          },
          phase: { ...createFakeSdTicket().phase, category: 'CLOSED' },
        }),
      ),
    )
    const dto = expectOk(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 3 }),
    )
    expect(dto.csatComment).toBeNull()
    expect(recordSdTicketEvent).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { hasComment: false } }),
    )
  })

  it('refuses agents that are not the requester', async () => {
    actAs('agent')
    engine.resolveRef.mockResolvedValue(ok(resolved({ requesterId: 'u2' })))
    const error = expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'SD_TICKET_FORBIDDEN',
    )
    expect(error.message).toMatch(/solicitante/)
    expect(repo.submit).not.toHaveBeenCalled()
  })

  it('hides tickets of other requesters', async () => {
    actAs('requester')
    engine.resolveRef.mockResolvedValue(
      ok(resolved({ requesterId: 'u2', participants: [] })),
    )
    const error = expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'SD_TICKET_FORBIDDEN',
    )
    expect(error.message).not.toMatch(/solicitante/)
  })

  it('only allows rating resolved or closed tickets', async () => {
    actAs('requester')
    engine.resolveRef.mockResolvedValue(
      ok(resolved({ phase: { ...createFakeSdTicket().phase } })),
    )
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'SD_CSAT_NOT_AVAILABLE',
    )
  })

  it('only allows one rating (already rated or lost the race)', async () => {
    actAs('requester')
    engine.resolveRef.mockResolvedValue(ok(resolved({ csatScore: 2 })))
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'SD_CSAT_ALREADY_SUBMITTED',
    )

    engine.resolveRef.mockResolvedValue(ok(resolved()))
    repo.submit.mockResolvedValue(ok(false))
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'SD_CSAT_ALREADY_SUBMITTED',
    )
    expect(recordSdTicketEvent).not.toHaveBeenCalled()
  })

  it('propagates access, config, lookup and write failures', async () => {
    actAs('non-member')
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'FORBIDDEN',
    )

    actAs('requester')
    moduleAccess.isEnabled.mockResolvedValue(ok(false))
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'MODULE_DISABLED',
    )
    moduleAccess.isEnabled.mockResolvedValue(ok(true))

    engine.loadConfig.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'DATABASE_ERROR',
    )

    engine.resolveRef.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'SD_TICKET_NOT_FOUND',
    )

    engine.resolveRef.mockResolvedValue(ok(resolved()))
    repo.submit.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketCsatService.submit('u1', WS, 't1', { score: 4 }),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', entity: 'sd_ticket_csat' }),
    )
  })
})
