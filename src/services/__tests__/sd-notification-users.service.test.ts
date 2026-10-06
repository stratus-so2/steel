import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))
vi.mock('@/src/lib/mail/servicedesk/send-sd-ticket-notification', () => ({
  sendSdTicketNotificationEmail: vi.fn(),
}))
vi.mock('@/src/lib/whatsapp/send', () => ({
  WhatsAppSend: { text: vi.fn() },
}))
vi.mock('@/src/repositories/sd-notification.repository')
vi.mock('@/src/repositories/sd-integration.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/src/services/notification.service')

import { logger } from '@/lib/axiom/logger'
import { SdNotificationRepository } from '@/src/repositories/sd-notification.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { NotificationService } from '../notification.service'
import { notifySdUsers } from '../sd-notification.service'

const repo = vi.mocked(SdNotificationRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const notifications = vi.mocked(NotificationService)

const WS = 'ws1'

function input(overrides: Partial<Parameters<typeof notifySdUsers>[0]> = {}) {
  return {
    workspaceId: WS,
    event: 'oncall.shift',
    userIds: ['u1', 'u2', null, '', 'u1'],
    actorId: 'admin',
    title: 'Você está de plantão',
    body: 'Escala N1',
    hrefFor: (slug: string) => `/${slug}/servicedesk/settings?tab=oncall`,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  repo.filterAgentIds.mockImplementation(async (_ws, ids) => ok(ids))
  repo.listPreferencesForEvent.mockResolvedValue(ok([]))
  ctxRepo.findWorkspace.mockResolvedValue(
    ok({ id: WS, name: 'Acme', slug: 'acme' }),
  )
  notifications.notifyUsers.mockImplementation(async (args) =>
    ok(args.userIds.length),
  )
})

describe('notifySdUsers', () => {
  it('delivers in-app to the chosen users with the catalog kind and href', async () => {
    const result = expectOk(await notifySdUsers(input()))

    expect(result).toEqual({ recipients: 2, inApp: 2 })
    expect(notifications.notifyUsers).toHaveBeenCalledWith({
      workspaceId: WS,
      userIds: ['u1', 'u2'],
      kind: 'SD_ONCALL_SHIFT',
      title: 'Você está de plantão',
      body: 'Escala N1',
      href: '/acme/servicedesk/settings?tab=oncall',
    })
  })

  it('never notifies the actor', async () => {
    const result = expectOk(
      await notifySdUsers(input({ userIds: ['admin'], actorId: 'admin' })),
    )
    expect(result).toEqual({ recipients: 0, inApp: 0 })
    expect(notifications.notifyUsers).not.toHaveBeenCalled()
  })

  it('drops non-agents for agent-only events', async () => {
    repo.filterAgentIds.mockResolvedValue(ok(['u2']))
    const result = expectOk(await notifySdUsers(input()))
    expect(result.recipients).toBe(1)
    expect(notifications.notifyUsers.mock.calls[0][0].userIds).toEqual(['u2'])
  })

  it('skips agent filtering for open events', async () => {
    await notifySdUsers(
      input({ event: 'approval.canceled', userIds: ['u1'], actorId: null }),
    )
    expect(repo.filterAgentIds).not.toHaveBeenCalled()
    expect(notifications.notifyUsers.mock.calls[0][0].kind).toBe(
      'SD_APPROVAL_CANCELED',
    )
  })

  it('respects an opted-out IN_APP preference', async () => {
    repo.listPreferencesForEvent.mockResolvedValue(
      ok([
        {
          userId: 'u1',
          event: 'oncall.shift',
          channel: 'IN_APP',
          enabled: false,
        },
        {
          userId: 'u2',
          event: 'oncall.shift',
          channel: 'IN_APP',
          enabled: true,
        },
      ] as never),
    )
    const result = expectOk(await notifySdUsers(input()))
    expect(result).toEqual({ recipients: 2, inApp: 1 })
    expect(notifications.notifyUsers.mock.calls[0][0].userIds).toEqual(['u2'])
  })

  it('does not call the inbox when everybody opted out', async () => {
    repo.listPreferencesForEvent.mockResolvedValue(
      ok([
        {
          userId: 'u1',
          event: 'oncall.shift',
          channel: 'IN_APP',
          enabled: false,
        },
      ] as never),
    )
    const result = expectOk(await notifySdUsers(input({ userIds: ['u1'] })))
    expect(result).toEqual({ recipients: 1, inApp: 0 })
    expect(notifications.notifyUsers).not.toHaveBeenCalled()
  })

  it('rejects an unknown event', async () => {
    const error = expectErr(await notifySdUsers(input({ event: 'nope' })))
    expect(error.code).toBe('SD_NOTIFICATION_EVENT_UNKNOWN')
  })

  it('propagates repository failures', async () => {
    repo.filterAgentIds.mockResolvedValueOnce(err(databaseError()))
    expect(expectErr(await notifySdUsers(input())).code).toBe('DATABASE_ERROR')

    ctxRepo.findWorkspace.mockResolvedValueOnce(err(databaseError()))
    expect(expectErr(await notifySdUsers(input())).code).toBe('DATABASE_ERROR')

    repo.listPreferencesForEvent.mockResolvedValueOnce(err(databaseError()))
    expect(expectErr(await notifySdUsers(input())).code).toBe('DATABASE_ERROR')
  })

  it('returns zero when the workspace is gone', async () => {
    ctxRepo.findWorkspace.mockResolvedValue(ok(null))
    expect(expectOk(await notifySdUsers(input()))).toEqual({
      recipients: 0,
      inApp: 0,
    })
  })

  it('logs (and swallows) an inbox failure', async () => {
    notifications.notifyUsers.mockResolvedValue(err(databaseError()))
    const result = expectOk(await notifySdUsers(input()))
    expect(result).toEqual({ recipients: 2, inApp: 0 })
    expect(logger.error).toHaveBeenCalledWith(
      'servicedesk.notify.in_app_failed',
      expect.objectContaining({ event: 'oncall.shift' }),
    )
  })
})
