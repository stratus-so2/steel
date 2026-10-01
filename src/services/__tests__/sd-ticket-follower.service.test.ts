import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdTicketForbidden } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/sd-notification.repository')
vi.mock('../sd-ticket-event-recorder', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-event-recorder')>()),
  recordSdTicketEvent: vi.fn(async () => ok(1)),
}))
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
}))

import { auditMutation } from '@/lib/axiom/audit'
import { SdNotificationRepository } from '@/src/repositories/sd-notification.repository'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { SdTicketFollowerService } from '../sd-ticket-follower.service'
import { loadSdTicketTab } from '../sd-ticket-tab-support'

const repo = vi.mocked(SdNotificationRepository)
const load = vi.mocked(loadSdTicketTab)
const record = vi.mocked(recordSdTicketEvent)

const at = new Date('2026-10-01T12:00:00.000Z')

function followerRow(userId: string) {
  return {
    userId,
    createdAt: at,
    user: {
      id: userId,
      name: `Nome ${userId}`,
      email: `${userId}@example.com`,
      image: null,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  load.mockResolvedValue(ok(sdTabScope()))
  repo.listFollowers.mockResolvedValue(ok([followerRow('u1')]))
  repo.addFollower.mockResolvedValue(ok(true))
  repo.removeFollower.mockResolvedValue(ok(true))
  repo.findRecipients.mockResolvedValue(
    ok([{ id: 'u1', name: 'Ana Agente', email: 'ana@example.com' }]),
  )
})

describe('SdTicketFollowerService.list', () => {
  it('lista os seguidores e marca se o usuário está entre eles', async () => {
    const dto = expectOk(await SdTicketFollowerService.list('u1', 'ws1', 't1'))
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'VIEW')
    expect(dto.items).toEqual([
      {
        userId: 'u1',
        name: 'Nome u1',
        email: 'u1@example.com',
        image: null,
        followedAt: at.toISOString(),
      },
    ])
    expect(dto.following).toBe(true)

    expect(
      expectOk(await SdTicketFollowerService.list('outro', 'ws1', 't1'))
        .following,
    ).toBe(false)
  })

  it('propaga falta de acesso e erro do repositório', async () => {
    load.mockResolvedValueOnce(err(sdTicketForbidden()))
    expectErr(
      await SdTicketFollowerService.list('u1', 'ws1', 't1'),
      'SD_TICKET_FORBIDDEN',
    )

    repo.listFollowers.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketFollowerService.list('u1', 'ws1', 't1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdTicketFollowerService.follow', () => {
  it('registra o vínculo, o evento e a auditoria', async () => {
    const dto = expectOk(
      await SdTicketFollowerService.follow('u1', 'ws1', 't1'),
    )
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'EDIT')
    expect(repo.addFollower).toHaveBeenCalledWith('t1', 'u1')
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'follower.added',
        actorKind: 'AGENT',
        actorUserId: 'u1',
        toValue: { id: 'u1', label: 'Ana Agente' },
      }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket_follower',
        action: 'create',
      }),
    )
    expect(dto.following).toBe(true)
  })

  it('é idempotente: seguir de novo não gera evento', async () => {
    repo.addFollower.mockResolvedValue(ok(false))
    expectOk(await SdTicketFollowerService.follow('u1', 'ws1', 't1'))
    expect(record).not.toHaveBeenCalled()
    expect(auditMutation).not.toHaveBeenCalled()
  })

  it('usa o id como rótulo quando o nome não é lido', async () => {
    repo.findRecipients.mockResolvedValue(err(databaseError()))
    expectOk(await SdTicketFollowerService.follow('u1', 'ws1', 't1'))
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ toValue: { id: 'u1', label: 'u1' } }),
    )

    record.mockClear()
    repo.findRecipients.mockResolvedValue(ok([]))
    expectOk(await SdTicketFollowerService.follow('u1', 'ws1', 't1'))
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ toValue: { id: 'u1', label: 'u1' } }),
    )
  })

  it('marca o ator como solicitante quando não é agente', async () => {
    load.mockResolvedValue(ok(sdTabScope({ userId: 'req', isAgent: false })))
    expectOk(await SdTicketFollowerService.follow('req', 'ws1', 't1'))
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ actorKind: 'REQUESTER' }),
    )
  })

  it('propaga falta de acesso e erro de escrita', async () => {
    load.mockResolvedValueOnce(err(sdTicketForbidden()))
    expectErr(
      await SdTicketFollowerService.follow('u1', 'ws1', 't1'),
      'SD_TICKET_FORBIDDEN',
    )

    repo.addFollower.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketFollowerService.follow('u1', 'ws1', 't1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdTicketFollowerService.unfollow', () => {
  it('remove o vínculo, registra o evento e audita', async () => {
    repo.listFollowers.mockResolvedValue(ok([]))
    const dto = expectOk(
      await SdTicketFollowerService.unfollow('u1', 'ws1', 't1'),
    )
    expect(repo.removeFollower).toHaveBeenCalledWith('t1', 'u1')
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'follower.removed',
        fromValue: { id: 'u1', label: 'Ana Agente' },
      }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_ticket_follower',
        action: 'delete',
      }),
    )
    expect(dto.following).toBe(false)
  })

  it('é idempotente: quem não seguia não gera evento', async () => {
    repo.removeFollower.mockResolvedValue(ok(false))
    expectOk(await SdTicketFollowerService.unfollow('u1', 'ws1', 't1'))
    expect(record).not.toHaveBeenCalled()
  })

  it('propaga falta de acesso e erro de escrita', async () => {
    load.mockResolvedValueOnce(err(sdTicketForbidden()))
    expectErr(
      await SdTicketFollowerService.unfollow('u1', 'ws1', 't1'),
      'SD_TICKET_FORBIDDEN',
    )

    repo.removeFollower.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketFollowerService.unfollow('u1', 'ws1', 't1'),
      'DATABASE_ERROR',
    )
  })
})
