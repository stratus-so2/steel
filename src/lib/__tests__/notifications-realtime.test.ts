import { beforeEach, describe, expect, it, vi } from 'vitest'

const publish = vi.fn()
const subscribe = vi.fn()
const unsubscribe = vi.fn()
const quit = vi.fn()
const handlers: Record<string, (...args: string[]) => void> = {}
const duplicate = vi.fn(() => ({
  subscribe,
  unsubscribe,
  quit,
  on: (name: string, fn: (...args: string[]) => void) => {
    handlers[name] = fn
  },
}))

vi.mock('@/src/lib/queue/connection', () => ({
  getQueueConnection: () => ({ publish, duplicate }),
}))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import {
  type NotificationRealtimeEvent,
  notificationChannelForWorkspace,
  publishNotificationEvent,
  subscribeNotificationEvents,
} from '@/src/lib/notifications/realtime'

const event: NotificationRealtimeEvent = {
  type: 'notification.created',
  kind: 'SD_SLA_BREACHED',
  at: '2026-10-01T12:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  publish.mockResolvedValue(1)
  subscribe.mockResolvedValue(1)
  unsubscribe.mockResolvedValue(1)
  quit.mockResolvedValue('OK')
})

describe('notificationChannelForWorkspace', () => {
  it('should be namespaced per workspace', () => {
    expect(notificationChannelForWorkspace('ws1')).toBe(
      'notifications:workspace:ws1',
    )
  })
})

describe('publishNotificationEvent', () => {
  it('should publish the event with its recipients', async () => {
    await publishNotificationEvent('ws1', ['u1', 'u2'], event)

    expect(publish).toHaveBeenCalledWith(
      'notifications:workspace:ws1',
      JSON.stringify({ event, userIds: ['u1', 'u2'] }),
    )
  })

  it('should skip publishing with no recipients', async () => {
    await publishNotificationEvent('ws1', [], event)
    expect(publish).not.toHaveBeenCalled()
  })

  it('should log and swallow a Redis failure', async () => {
    publish.mockRejectedValue(new Error('redis down'))

    await expect(
      publishNotificationEvent('ws1', ['u1'], event),
    ).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      'notifications.realtime.publish_failed',
      expect.objectContaining({ workspaceId: 'ws1', message: 'redis down' }),
    )
  })
})

describe('subscribeNotificationEvents', () => {
  it('should deliver the event and its recipients, and unsubscribe on teardown', async () => {
    const onEvent = vi.fn()
    const stop = subscribeNotificationEvents('ws1', onEvent)

    handlers.message(
      'notifications:workspace:ws1',
      JSON.stringify({ event, userIds: ['u1'] }),
    )
    expect(onEvent).toHaveBeenCalledWith(event, ['u1'])

    stop()
    expect(unsubscribe).toHaveBeenCalledWith('notifications:workspace:ws1')
  })

  it('should ignore another channel, a malformed payload and a missing audience', () => {
    const onEvent = vi.fn()
    subscribeNotificationEvents('ws1', onEvent)

    handlers.message('other:channel', JSON.stringify({ event, userIds: [] }))
    handlers.message('notifications:workspace:ws1', 'not json')
    handlers.message('notifications:workspace:ws1', JSON.stringify({}))
    expect(onEvent).not.toHaveBeenCalled()

    handlers.message(
      'notifications:workspace:ws1',
      JSON.stringify({ event, userIds: 'nope' }),
    )
    expect(onEvent).toHaveBeenCalledWith(event, [])
  })

  it('should log a failed subscription', async () => {
    subscribe.mockRejectedValue(new Error('no redis'))
    subscribeNotificationEvents('ws1', vi.fn())

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'notifications.realtime.subscribe_failed',
        expect.objectContaining({ workspaceId: 'ws1', message: 'no redis' }),
      ),
    )
  })
})
