import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/notification-audience.repository')
vi.mock('../notification.service', () => ({
  NotificationService: { notifyUsers: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { NotificationAudienceRepository } from '@/src/repositories/notification-audience.repository'
import { NotificationService } from '../notification.service'
import {
  notifyWhatsAppUsers,
  WHATSAPP_NOTIFY_ADMIN_CAP,
  whatsAppAdminIds,
  whatsAppConversationHref,
} from '../whatsapp-notify'

const audience = vi.mocked(NotificationAudienceRepository)
const notifications = vi.mocked(NotificationService)

const input = (overrides = {}) => ({
  workspaceId: 'ws1',
  kind: 'WHATSAPP_CONVERSATION_ASSIGNED' as const,
  userIds: ['u1', 'u2', null, '', 'u1', 'actor'],
  actorId: 'actor',
  title: 'Conversa atribuída a você',
  body: 'Conversa com Ana.',
  hrefFor: (slug: string) => whatsAppConversationHref(slug, 'c1'),
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  audience.findWorkspaceSlug.mockResolvedValue(ok('acme'))
  notifications.notifyUsers.mockImplementation(async (args) =>
    ok(args.userIds.length),
  )
})

describe('notifyWhatsAppUsers', () => {
  it('delivers to the unique recipients, never the actor, with the slug link', async () => {
    expect(await notifyWhatsAppUsers(input())).toBe(2)
    expect(notifications.notifyUsers).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userIds: ['u1', 'u2'],
      kind: 'WHATSAPP_CONVERSATION_ASSIGNED',
      title: 'Conversa atribuída a você',
      body: 'Conversa com Ana.',
      href: '/acme/zap?conversa=c1',
    })
  })

  it('does nothing without recipients (e.g. self-assign)', async () => {
    expect(await notifyWhatsAppUsers(input({ userIds: ['actor'] }))).toBe(0)
    expect(audience.findWorkspaceSlug).not.toHaveBeenCalled()
  })

  it('swallows every failure, only logging it', async () => {
    audience.findWorkspaceSlug.mockResolvedValueOnce(err(databaseError()))
    expect(await notifyWhatsAppUsers(input())).toBe(0)
    audience.findWorkspaceSlug.mockResolvedValueOnce(ok(null))
    expect(await notifyWhatsAppUsers(input())).toBe(0)
    notifications.notifyUsers.mockResolvedValueOnce(err(databaseError()))
    expect(await notifyWhatsAppUsers(input())).toBe(0)
    expect(
      vi.mocked(logger.warn).mock.calls.map((call) => call[1]?.reason),
    ).toEqual(['DATABASE_ERROR', 'WORKSPACE_MISSING', 'DATABASE_ERROR'])
  })
})

describe('whatsAppAdminIds', () => {
  it('lists the capped admins', async () => {
    audience.listPrivilegedUserIds.mockResolvedValue(ok(['owner']))
    expect(await whatsAppAdminIds('ws1')).toEqual(['owner'])
    expect(audience.listPrivilegedUserIds).toHaveBeenCalledWith(
      'ws1',
      WHATSAPP_NOTIFY_ADMIN_CAP,
    )
  })

  it('falls back to nobody on failure', async () => {
    audience.listPrivilegedUserIds.mockResolvedValue(err(databaseError()))
    expect(await whatsAppAdminIds('ws1')).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(
      'whatsapp.notify.admins_failed',
      expect.objectContaining({ workspaceId: 'ws1' }),
    )
  })
})
