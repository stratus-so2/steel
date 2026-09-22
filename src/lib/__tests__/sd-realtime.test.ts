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
  canReceiveSdTicketEvent,
  publishSdTicketEvent,
  type SdTicketRealtimeEvent,
  sdAudienceIds,
  sdChannelForWorkspace,
  subscribeSdTicketEvents,
} from '@/src/lib/servicedesk/realtime'

const event: SdTicketRealtimeEvent = {
  type: 'ticket.updated',
  ticketId: 't1',
  number: 7,
  at: '2026-09-21T12:00:00.000Z',
}

beforeEach(() => {
  publish.mockResolvedValue(1)
  subscribe.mockResolvedValue(1)
  unsubscribe.mockResolvedValue(1)
  quit.mockResolvedValue('OK')
})

describe('sdAudienceIds', () => {
  it('dedupes and drops empty ids', () => {
    expect(
      sdAudienceIds({
        requesterId: 'u1',
        contactUserId: 'u1',
        participantIds: ['u2', '', 'u3'],
      }),
    ).toEqual(['u1', 'u2', 'u3'])
    expect(sdAudienceIds()).toEqual([])
  })
})

describe('publishSdTicketEvent', () => {
  it('publishes the envelope on the workspace channel', async () => {
    await publishSdTicketEvent('ws1', event, { requesterId: 'u1' })
    expect(publish).toHaveBeenCalledWith(
      'servicedesk:workspace:ws1',
      JSON.stringify({ event, audience: ['u1'] }),
    )
    expect(sdChannelForWorkspace('x')).toBe('servicedesk:workspace:x')
  })

  it('logs and swallows publish failures', async () => {
    publish.mockRejectedValueOnce(new Error('down'))
    await publishSdTicketEvent('ws1', event)
    publish.mockRejectedValueOnce('boom')
    await publishSdTicketEvent('ws1', event)
    expect(logger.error).toHaveBeenCalledTimes(2)
    expect(logger.error).toHaveBeenLastCalledWith(
      'servicedesk.realtime.publish_failed',
      expect.objectContaining({ message: 'boom' }),
    )
  })
})

describe('subscribeSdTicketEvents', () => {
  it('delivers parsed events of its channel only and unsubscribes', async () => {
    const received: unknown[] = []
    const stop = subscribeSdTicketEvents('ws1', (e, audience) =>
      received.push([e.ticketId, audience]),
    )
    expect(subscribe).toHaveBeenCalledWith('servicedesk:workspace:ws1')

    handlers.message(
      'servicedesk:workspace:ws1',
      JSON.stringify({ event, audience: ['u1'] }),
    )
    handlers.message('servicedesk:workspace:other', JSON.stringify({ event }))
    handlers.message('servicedesk:workspace:ws1', JSON.stringify({ event }))
    handlers.message('servicedesk:workspace:ws1', '{bad')
    handlers.message('servicedesk:workspace:ws1', JSON.stringify({ x: 1 }))
    expect(received).toEqual([
      ['t1', ['u1']],
      ['t1', []],
    ])

    stop()
    await vi.waitFor(() => expect(quit).toHaveBeenCalled())
    expect(unsubscribe).toHaveBeenCalledWith('servicedesk:workspace:ws1')
  })

  it('logs subscribe failures and ignores quit errors', async () => {
    subscribe.mockRejectedValueOnce(new Error('nope'))
    quit.mockRejectedValueOnce(new Error('closed'))
    const stop = subscribeSdTicketEvents('ws1', () => undefined)
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'servicedesk.realtime.subscribe_failed',
        expect.objectContaining({ message: 'nope' }),
      ),
    )
    stop()
    await vi.waitFor(() => expect(quit).toHaveBeenCalled())

    subscribe.mockRejectedValueOnce('str')
    subscribeSdTicketEvents('ws1', () => undefined)
    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        'servicedesk.realtime.subscribe_failed',
        expect.objectContaining({ message: 'str' }),
      ),
    )
  })
})

describe('canReceiveSdTicketEvent', () => {
  it('lets agents see everything', () => {
    expect(
      canReceiveSdTicketEvent(
        { userId: 'a', isAgent: true },
        { ...event, internal: true },
        [],
      ),
    ).toBe(true)
  })

  it('limits requesters to their tickets and public events', () => {
    const viewer = { userId: 'u1', isAgent: false }
    expect(canReceiveSdTicketEvent(viewer, event, ['u1'])).toBe(true)
    expect(canReceiveSdTicketEvent(viewer, event, ['u2'])).toBe(false)
    expect(
      canReceiveSdTicketEvent(viewer, { ...event, internal: true }, ['u1']),
    ).toBe(false)
  })
})
