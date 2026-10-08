import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdIntegration } from '@/src/__tests__/factories/sd-integration.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdIntegrationRequestFailed } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/env', () => ({ NEXT_PUBLIC_URL: 'https://steel.test' }))
vi.mock('@/src/lib/crypto', () => ({
  decryptConnectionSecret: vi.fn(async (v: string) => v.replace(/^enc:/, '')),
}))
vi.mock('@/src/cache/sd-integration-event.cache', () => ({
  SdIntegrationEventCache: { claim: vi.fn(), release: vi.fn() },
}))
vi.mock('@/src/lib/queue/queues', () => {
  const add = vi.fn()
  return { getWorkspaceIntegrationsQueue: () => ({ add }) }
})
vi.mock('@/src/lib/servicedesk/slack-client', () => ({
  SlackClient: { postMessage: vi.fn() },
}))
vi.mock('@/src/repositories/workspace-integration.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/repositories/workspace-module-access.repository')

import { logger } from '@/lib/axiom/logger'
import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import { getWorkspaceIntegrationsQueue } from '@/src/lib/queue/queues'
import { SlackClient } from '@/src/lib/servicedesk/slack-client'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { WorkspaceIntegrationRepository } from '@/src/repositories/workspace-integration.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  COMMUNICATION_WAITING_EVENT,
  notifyWorkspaceSlack,
  slackNotificationText,
  WorkspaceSlackNotifier,
} from '../workspace-slack-notifier'

const repo = vi.mocked(WorkspaceIntegrationRepository)
const workspaces = vi.mocked(WorkspaceRepository)
const modules = vi.mocked(WorkspaceModuleAccessRepository)
const slack = vi.mocked(SlackClient)
const cache = vi.mocked(SdIntegrationEventCache)
const add = vi.mocked(getWorkspaceIntegrationsQueue().add)

const WS = 'ws1'

const RULES = {
  routes: [
    { event: 'crm.deal.won', channelId: 'C-sales', channelName: 'vendas' },
    { event: 'crm.deal.won', channelId: 'C-board', channelName: 'diretoria' },
    {
      event: COMMUNICATION_WAITING_EVENT,
      channelId: 'C-zap',
      channelName: 'atendimento',
    },
  ],
  waitingMinutes: 20,
}

beforeEach(() => {
  vi.clearAllMocks()
  repo.findByKind.mockResolvedValue(
    ok(createFakeSdIntegration({ config: RULES })),
  )
  repo.findById.mockResolvedValue(
    ok(createFakeSdIntegration({ config: RULES })),
  )
  repo.markError.mockResolvedValue(ok(undefined))
  repo.markEvent.mockResolvedValue(ok(undefined))
  workspaces.findById.mockResolvedValue(ok({ id: WS, slug: 'acme' } as never))
  slack.postMessage.mockResolvedValue(ok({ channel: 'C', ts: '1.1' }))
  modules.isEnabled.mockResolvedValue(ok(true))
  cache.claim.mockResolvedValue(true)
  add.mockResolvedValue({} as never)
})

describe('slackNotificationText', () => {
  it('escapes the text and links back to Steel', () => {
    expect(
      slackNotificationText({
        title: 'Negócio <ganho>',
        body: '  A & B  ',
        url: 'https://steel.test/acme/crm',
      }),
    ).toBe(
      '*Negócio &lt;ganho&gt;*\nA &amp; B\n<https://steel.test/acme/crm|Abrir no Steel>',
    )
    expect(slackNotificationText({ title: 'T', body: ' ', url: null })).toBe(
      '*T*',
    )
  })
})

describe('notifyWorkspaceSlack', () => {
  it('enqueues a routed event with the absolute link', async () => {
    expect(
      await notifyWorkspaceSlack({
        workspaceId: WS,
        event: 'crm.deal.won',
        title: 'Negócio ganho: ACME',
        body: 'Fechado',
        path: '/crm/leads?record=l1',
      }),
    ).toBe(true)
    expect(add).toHaveBeenCalledWith('slack-notify', {
      workspaceId: WS,
      integrationId: 'int-slack-1',
      event: 'crm.deal.won',
      title: 'Negócio ganho: ACME',
      body: 'Fechado',
      url: 'https://steel.test/acme/crm/leads?record=l1',
    })
  })

  it('sends no link without a path or when the workspace lookup fails', async () => {
    await notifyWorkspaceSlack({
      workspaceId: WS,
      event: 'crm.deal.won',
      title: 'T',
      body: 'B',
    })
    expect(add.mock.calls[0][1].url).toBeNull()
    workspaces.findById.mockResolvedValueOnce(err(databaseError()))
    await notifyWorkspaceSlack({
      workspaceId: WS,
      event: 'crm.deal.won',
      title: 'T',
      body: 'B',
      path: '/x',
    })
    expect(add.mock.calls[1][1].url).toBeNull()
  })

  it('does nothing without a rule, a connection, or with it disconnected', async () => {
    expect(
      await notifyWorkspaceSlack({
        workspaceId: WS,
        event: 'crm.lead.created',
        title: 'T',
        body: 'B',
      }),
    ).toBe(false)
    repo.findByKind.mockResolvedValueOnce(ok(null))
    expect(
      await notifyWorkspaceSlack({
        workspaceId: WS,
        event: 'crm.deal.won',
        title: 'T',
        body: 'B',
      }),
    ).toBe(false)
    repo.findByKind.mockResolvedValueOnce(
      ok(createFakeSdIntegration({ status: 'DISCONNECTED', config: RULES })),
    )
    expect(
      await notifyWorkspaceSlack({
        workspaceId: WS,
        event: 'crm.deal.won',
        title: 'T',
        body: 'B',
      }),
    ).toBe(false)
    expect(add).not.toHaveBeenCalled()
  })

  it('never throws: lookup and queue failures are only logged', async () => {
    repo.findByKind.mockResolvedValueOnce(err(databaseError()))
    expect(
      await notifyWorkspaceSlack({
        workspaceId: WS,
        event: 'crm.deal.won',
        title: 'T',
        body: 'B',
      }),
    ).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(
      'integrations.slack.lookup_failed',
      expect.any(Object),
    )
    add.mockRejectedValueOnce(new Error('redis caiu'))
    expect(
      await notifyWorkspaceSlack({
        workspaceId: WS,
        event: 'crm.deal.won',
        title: 'T',
        body: 'B',
      }),
    ).toBe(false)
    add.mockRejectedValueOnce('texto')
    expect(
      await notifyWorkspaceSlack({
        workspaceId: WS,
        event: 'crm.deal.won',
        title: 'T',
        body: 'B',
      }),
    ).toBe(false)
    expect(logger.warn).toHaveBeenCalledWith(
      'integrations.slack.enqueue_failed',
      expect.any(Object),
    )
  })
})

describe('WorkspaceSlackNotifier.deliver', () => {
  const job = {
    workspaceId: WS,
    integrationId: 'int-slack-1',
    event: 'crm.deal.won',
    title: 'Negócio ganho',
    body: 'ACME',
    url: 'https://steel.test/acme/crm',
  }

  it('posts to every rule channel and stamps the last event', async () => {
    expect(expectOk(await WorkspaceSlackNotifier.deliver(job))).toBe('sent')
    expect(slack.postMessage.mock.calls.map(([, m]) => m.channel)).toEqual([
      'C-sales',
      'C-board',
    ])
    expect(slack.postMessage.mock.calls[0][0]).toBe('xoxb-token')
    expect(repo.markEvent).toHaveBeenCalledWith(
      'int-slack-1',
      'slack:crm.deal.won',
    )
  })

  it('skips what changed since the enqueue', async () => {
    repo.findById.mockResolvedValueOnce(
      ok(createFakeSdIntegration({ status: 'DISCONNECTED', config: RULES })),
    )
    expect(expectOk(await WorkspaceSlackNotifier.deliver(job))).toBe(
      'skipped_disconnected',
    )
    repo.findById.mockResolvedValueOnce(
      ok(createFakeSdIntegration({ config: {} })),
    )
    expect(expectOk(await WorkspaceSlackNotifier.deliver(job))).toBe(
      'skipped_not_routed',
    )
  })

  it('refuses a missing connection, another workspace and an unreadable token', async () => {
    repo.findById.mockResolvedValueOnce(ok(null))
    expectErr(
      await WorkspaceSlackNotifier.deliver(job),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.findById.mockResolvedValueOnce(
      ok(createFakeSdIntegration({ workspaceId: 'outra', config: RULES })),
    )
    expectErr(
      await WorkspaceSlackNotifier.deliver(job),
      'SD_INTEGRATION_NOT_FOUND',
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(await WorkspaceSlackNotifier.deliver(job), 'DATABASE_ERROR')
    repo.findById.mockResolvedValueOnce(
      ok(createFakeSdIntegration({ encryptedToken: '', config: RULES })),
    )
    expectErr(
      await WorkspaceSlackNotifier.deliver(job),
      'SD_INTEGRATION_NOT_CONFIGURED',
    )
  })

  it('stamps the Slack error and fails the job', async () => {
    slack.postMessage.mockResolvedValueOnce(
      err(sdIntegrationRequestFailed('channel_not_found')),
    )
    expectErr(
      await WorkspaceSlackNotifier.deliver(job),
      'SD_INTEGRATION_REQUEST_FAILED',
    )
    expect(repo.markError).toHaveBeenCalledWith(
      'int-slack-1',
      'channel_not_found',
    )
    expect(repo.markEvent).not.toHaveBeenCalled()
  })
})

describe('WorkspaceSlackNotifier.runWaitingTick', () => {
  const NOW = new Date('2026-10-08T12:00:00.000Z')

  beforeEach(() => {
    repo.listLiveByKind.mockResolvedValue(
      ok([
        createFakeSdIntegration({ config: RULES }),
        createFakeSdIntegration({ id: 'int-2', workspaceId: 'ws2' }),
      ]),
    )
    repo.listWaitingConversations.mockResolvedValue(
      ok([
        {
          id: 'conv-1',
          lastMessageAt: new Date('2026-10-08T11:30:00.000Z'),
          unreadCount: 3,
          contactName: 'Maria',
        },
        {
          id: 'conv-2',
          lastMessageAt: new Date('2026-10-08T11:00:00.000Z'),
          unreadCount: 1,
          contactName: null,
        },
      ]),
    )
  })

  it('announces each waiting conversation once, with the threshold window', async () => {
    cache.claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    expect(expectOk(await WorkspaceSlackNotifier.runWaitingTick(NOW))).toEqual({
      workspaces: 1,
      notified: 1,
    })
    expect(repo.listWaitingConversations).toHaveBeenCalledWith(
      WS,
      new Date('2026-10-08T11:40:00.000Z'),
      new Date('2026-10-07T12:00:00.000Z'),
      50,
    )
    expect(cache.claim).toHaveBeenCalledWith(
      'waiting',
      'conv-1:2026-10-08T11:30:00.000Z',
    )
    expect(add).toHaveBeenCalledWith(
      'slack-notify',
      expect.objectContaining({
        event: COMMUNICATION_WAITING_EVENT,
        title: 'Conversa aguardando resposta há 30 min',
        body: 'Maria · 3 mensagem(ns) sem resposta',
        url: 'https://steel.test/acme/zap?conversa=conv-1',
      }),
    )
  })

  it('names an anonymous contact and counts only enqueued alerts', async () => {
    add.mockRejectedValueOnce(new Error('fila fora'))
    expect(expectOk(await WorkspaceSlackNotifier.runWaitingTick(NOW))).toEqual({
      workspaces: 1,
      notified: 1,
    })
    expect(add.mock.calls[1][1].body).toBe(
      'Contato sem nome · 1 mensagem(ns) sem resposta',
    )
  })

  it('skips workspaces without Comunicação and survives lookup errors', async () => {
    modules.isEnabled.mockResolvedValueOnce(ok(false))
    expect(expectOk(await WorkspaceSlackNotifier.runWaitingTick(NOW))).toEqual({
      workspaces: 0,
      notified: 0,
    })
    modules.isEnabled.mockResolvedValueOnce(err(databaseError()))
    expect(
      expectOk(await WorkspaceSlackNotifier.runWaitingTick(NOW)).workspaces,
    ).toBe(0)
    repo.listWaitingConversations.mockResolvedValueOnce(err(databaseError()))
    expect(expectOk(await WorkspaceSlackNotifier.runWaitingTick(NOW))).toEqual({
      workspaces: 1,
      notified: 0,
    })
    expect(logger.warn).toHaveBeenCalledWith(
      'integrations.slack.waiting_lookup_failed',
      expect.any(Object),
    )
  })

  it('uses the current time by default and propagates the listing error', async () => {
    repo.listLiveByKind.mockResolvedValueOnce(ok([]))
    expect(expectOk(await WorkspaceSlackNotifier.runWaitingTick())).toEqual({
      workspaces: 0,
      notified: 0,
    })
    repo.listLiveByKind.mockResolvedValueOnce(err(databaseError()))
    expectErr(await WorkspaceSlackNotifier.runWaitingTick(), 'DATABASE_ERROR')
  })
})
