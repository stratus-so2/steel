import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/notification.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { NotificationRepository } from '@/src/repositories/notification.repository'
import { NotificationService } from '../notification.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedNotificationRepo = vi.mocked(NotificationRepository)

describe('NotificationService', () => {
  it('should list the actor notifications with the unread count', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    mockedNotificationRepo.listByUser.mockResolvedValue(
      ok([
        {
          id: 'n1',
          workspaceId: 'ws1',
          userId: 'u1',
          kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
          title: 'Sentimento negativo: Maria',
          body: 'Média -0,50',
          href: '/clinica/zap?conversa=c1',
          readAt: null,
          createdAt: new Date('2026-09-18T12:00:00Z'),
        },
      ]),
    )
    mockedNotificationRepo.countUnread.mockResolvedValue(ok(1))

    const result = expectOk(await NotificationService.list('u1', 'ws1'))

    expect(result.unreadCount).toBe(1)
    expect(result.items[0]).toEqual(
      expect.objectContaining({ id: 'n1', read: false }),
    )
    expect(mockedNotificationRepo.listByUser).toHaveBeenCalledWith(
      'ws1',
      'u1',
      50,
    )
  })

  it('should forbid non-members', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await NotificationService.list('x', 'ws1'), 'FORBIDDEN')
  })

  it('should only mark the actor own notifications as read', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'VIEWER' })),
    )
    mockedNotificationRepo.markRead.mockResolvedValue(ok(2))

    expect(
      expectOk(await NotificationService.markRead('u1', 'ws1', {})),
    ).toEqual({ updated: 2 })
    expect(mockedNotificationRepo.markRead).toHaveBeenCalledWith(
      'ws1',
      'u1',
      undefined,
    )
  })

  it('should dedupe recipients when notifying users', async () => {
    mockedNotificationRepo.createMany.mockResolvedValue(ok(2))

    await NotificationService.notifyUsers({
      workspaceId: 'ws1',
      userIds: ['a', 'b', 'a'],
      kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
      title: 't',
      body: 'b',
    })

    expect(mockedNotificationRepo.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'a', href: null }),
      expect.objectContaining({ userId: 'b' }),
    ])
  })
})
