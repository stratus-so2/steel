import type { Notification } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'
import type { NotificationListQueryDTO } from '@/src/schemas/notification.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/notification.repository')
vi.mock('@/src/lib/notifications/realtime', () => ({
  publishNotificationEvent: vi.fn().mockResolvedValue(undefined),
}))

import { publishNotificationEvent } from '@/src/lib/notifications/realtime'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { NotificationRepository } from '@/src/repositories/notification.repository'
import { NotificationService } from '../notification.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedNotificationRepo = vi.mocked(NotificationRepository)
const mockedPublish = vi.mocked(publishNotificationEvent)

function row(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    workspaceId: 'ws1',
    userId: 'u1',
    kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
    title: 'Sentimento negativo: Maria',
    body: 'Média -0,50',
    href: '/clinica/zap?conversa=c1',
    readAt: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-09-18T12:00:00Z'),
    ...overrides,
  }
}

const COUNTS = { all: 3, unread: 1, archived: 2 }

function asMember(role: 'OWNER' | 'MEMBER' | 'VIEWER' = 'MEMBER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

function query(
  overrides: Partial<NotificationListQueryDTO> = {},
): NotificationListQueryDTO {
  return { folder: 'all', limit: 25, ...overrides }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedNotificationRepo.listPage.mockResolvedValue(
    ok({ items: [row()], nextCursor: null }),
  )
  mockedNotificationRepo.countFolders.mockResolvedValue(ok(COUNTS))
})

describe('NotificationService.list', () => {
  it('should list the actor notifications with the unread count', async () => {
    asMember()

    const result = expectOk(await NotificationService.list('u1', 'ws1'))

    expect(result.unreadCount).toBe(1)
    expect(result.counts).toEqual(COUNTS)
    expect(result.nextCursor).toBeNull()
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'n1',
        read: false,
        archived: false,
        module: 'COMMUNICATION',
      }),
    )
    expect(mockedNotificationRepo.listPage).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userId: 'u1',
      folder: 'all',
      kinds: undefined,
      search: undefined,
      cursor: undefined,
      limit: 50,
    })
  })

  it('should forbid non-members', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await NotificationService.list('x', 'ws1'), 'FORBIDDEN')
  })
})

describe('NotificationService.listInbox', () => {
  it('should forward the folder, search and cursor to the repository', async () => {
    asMember('VIEWER')
    mockedNotificationRepo.listPage.mockResolvedValue(
      ok({ items: [row({ archivedAt: new Date() })], nextCursor: 'n9' }),
    )

    const result = expectOk(
      await NotificationService.listInbox(
        'u1',
        'ws1',
        query({ folder: 'archived', search: 'sla', cursor: 'n5', limit: 10 }),
      ),
    )

    expect(result.nextCursor).toBe('n9')
    expect(result.items[0].archived).toBe(true)
    expect(mockedNotificationRepo.listPage).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'archived',
        search: 'sla',
        cursor: 'n5',
        limit: 10,
      }),
    )
  })

  it('should translate a module filter into its kinds', async () => {
    asMember()

    await NotificationService.listInbox(
      'u1',
      'ws1',
      query({ module: 'COMMUNICATION' }),
    )

    expect(mockedNotificationRepo.listPage).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['WHATSAPP_NEGATIVE_SENTIMENT'] }),
    )
  })

  it('should narrow a kind filter to that single kind', async () => {
    asMember()

    await NotificationService.listInbox(
      'u1',
      'ws1',
      query({ kind: 'SD_SLA_BREACHED' }),
    )

    expect(mockedNotificationRepo.listPage).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['SD_SLA_BREACHED'] }),
    )
  })

  it('should return nothing when the kind does not belong to the module', async () => {
    asMember()

    await NotificationService.listInbox(
      'u1',
      'ws1',
      query({ module: 'CRM', kind: 'SD_SLA_BREACHED' }),
    )

    expect(mockedNotificationRepo.listPage).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: [] }),
    )
  })

  it('should keep the kind when it does belong to the module', async () => {
    asMember()

    await NotificationService.listInbox(
      'u1',
      'ws1',
      query({ module: 'SERVICE_DESK', kind: 'SD_SLA_BREACHED' }),
    )

    expect(mockedNotificationRepo.listPage).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: ['SD_SLA_BREACHED'] }),
    )
  })

  it('should forbid non-members', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

    expectErr(
      await NotificationService.listInbox('x', 'ws1', query()),
      'FORBIDDEN',
    )
    expect(mockedNotificationRepo.listPage).not.toHaveBeenCalled()
  })
})

describe('NotificationService.markRead', () => {
  it('should only mark the actor own notifications as read', async () => {
    asMember('VIEWER')
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
})

describe('NotificationService.applyAction', () => {
  it('should apply an action to the deduped ids', async () => {
    asMember()
    mockedNotificationRepo.applyAction.mockResolvedValue(ok(2))

    expect(
      expectOk(
        await NotificationService.applyAction('u1', 'ws1', {
          action: 'archive',
          ids: ['n1', 'n2', 'n1'],
        }),
      ),
    ).toEqual({ updated: 2 })
    expect(mockedNotificationRepo.applyAction).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userId: 'u1',
      ids: ['n1', 'n2'],
      action: 'archive',
    })
  })

  it('should accept the undo of a deletion', async () => {
    asMember()
    mockedNotificationRepo.applyAction.mockResolvedValue(ok(1))

    expect(
      expectOk(
        await NotificationService.applyAction('u1', 'ws1', {
          action: 'restore',
          ids: ['n1'],
        }),
      ),
    ).toEqual({ updated: 1 })
  })

  it('should forbid non-members', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

    expectErr(
      await NotificationService.applyAction('u1', 'ws1', {
        action: 'delete',
        ids: ['n1'],
      }),
      'FORBIDDEN',
    )
    expect(mockedNotificationRepo.applyAction).not.toHaveBeenCalled()
  })
})

describe('NotificationService.notifyUsers', () => {
  it('should dedupe recipients and publish the realtime event', async () => {
    mockedNotificationRepo.createMany.mockResolvedValue(ok(2))

    expect(
      expectOk(
        await NotificationService.notifyUsers({
          workspaceId: 'ws1',
          userIds: ['a', 'b', 'a'],
          kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
          title: 't',
          body: 'b',
        }),
      ),
    ).toBe(2)

    expect(mockedNotificationRepo.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'a', href: null }),
      expect.objectContaining({ userId: 'b' }),
    ])
    expect(mockedPublish).toHaveBeenCalledWith(
      'ws1',
      ['a', 'b'],
      expect.objectContaining({
        type: 'notification.created',
        kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
      }),
    )
  })

  it('should not publish when nothing was created', async () => {
    mockedNotificationRepo.createMany.mockResolvedValue(ok(0))

    await NotificationService.notifyUsers({
      workspaceId: 'ws1',
      userIds: [],
      kind: 'SD_TICKET_ASSIGNED',
      title: 't',
      body: 'b',
      href: '/acme/servicedesk/tickets/1',
    })

    expect(mockedPublish).not.toHaveBeenCalled()
  })
})

describe('NotificationService failure paths', () => {
  const DB_ERROR = { code: 'DATABASE_ERROR' as const, message: 'db down' }

  it('listInbox() should propagate a listing failure', async () => {
    asMember()
    mockedNotificationRepo.listPage.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await NotificationService.listInbox('u1', 'ws1', query()),
      'DATABASE_ERROR',
    )
  })

  it('listInbox() should propagate a folder count failure', async () => {
    asMember()
    mockedNotificationRepo.countFolders.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await NotificationService.listInbox('u1', 'ws1', query()),
      'DATABASE_ERROR',
    )
  })

  it('markRead() should forbid non-members', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

    expectErr(await NotificationService.markRead('u1', 'ws1', {}), 'FORBIDDEN')
    expect(mockedNotificationRepo.markRead).not.toHaveBeenCalled()
  })

  it('markRead() should propagate an update failure', async () => {
    asMember()
    mockedNotificationRepo.markRead.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await NotificationService.markRead('u1', 'ws1', { ids: ['n1'] }),
      'DATABASE_ERROR',
    )
  })

  it('applyAction() should propagate an update failure', async () => {
    asMember()
    mockedNotificationRepo.applyAction.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await NotificationService.applyAction('u1', 'ws1', {
        action: 'delete',
        ids: ['n1'],
      }),
      'DATABASE_ERROR',
    )
  })

  it('notifyUsers() should propagate a creation failure without publishing', async () => {
    mockedNotificationRepo.createMany.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await NotificationService.notifyUsers({
        workspaceId: 'ws1',
        userIds: ['a'],
        kind: 'SD_DIGEST',
        title: 't',
        body: 'b',
      }),
      'DATABASE_ERROR',
    )
    expect(mockedPublish).not.toHaveBeenCalled()
  })
})
