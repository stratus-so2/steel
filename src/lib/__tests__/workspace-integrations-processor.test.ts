import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError, sdIntegrationRequestFailed } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/services/workspace-slack-notifier', () => ({
  WorkspaceSlackNotifier: { deliver: vi.fn(), runWaitingTick: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { WorkspaceIntegrationsJob } from '@/src/lib/queue/jobs'
import { processWorkspaceIntegrations } from '@/src/lib/queue/processors/workspace-integrations'
import { WorkspaceSlackNotifier } from '@/src/services/workspace-slack-notifier'

const notifier = vi.mocked(WorkspaceSlackNotifier)

const job = (name: string, data: unknown = {}): Job =>
  ({ id: 'j1', name, data }) as Job

const DATA = {
  workspaceId: 'ws1',
  integrationId: 'int-1',
  event: 'crm.deal.won',
  title: 'Negócio ganho',
  body: 'ACME',
  url: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  notifier.deliver.mockResolvedValue(ok('sent'))
  notifier.runWaitingTick.mockResolvedValue(ok({ workspaces: 1, notified: 2 }))
})

describe('slack-notify', () => {
  it('delivers through the notifier and logs the outcome', async () => {
    expect(
      await processWorkspaceIntegrations(
        job(WorkspaceIntegrationsJob.SlackNotify, DATA),
      ),
    ).toBe('sent')
    expect(notifier.deliver).toHaveBeenCalledWith(DATA)
    expect(logger.info).toHaveBeenCalledWith(
      'queue.workspace_integrations.slack_notified',
      expect.objectContaining({ workspaceId: 'ws1' }),
    )
  })

  it('throws so the queue retries a Slack failure', async () => {
    notifier.deliver.mockResolvedValue(err(sdIntegrationRequestFailed()))
    await expect(
      processWorkspaceIntegrations(
        job(WorkspaceIntegrationsJob.SlackNotify, DATA),
      ),
    ).rejects.toThrow('SD_INTEGRATION_REQUEST_FAILED')
  })
})

describe('communication-waiting-tick', () => {
  it('runs the tick and returns its counters', async () => {
    expect(
      await processWorkspaceIntegrations(
        job(WorkspaceIntegrationsJob.CommunicationWaitingTick),
      ),
    ).toEqual({ workspaces: 1, notified: 2 })
  })

  it('throws on a database error', async () => {
    notifier.runWaitingTick.mockResolvedValue(err(databaseError()))
    await expect(
      processWorkspaceIntegrations(
        job(WorkspaceIntegrationsJob.CommunicationWaitingTick),
      ),
    ).rejects.toThrow('DATABASE_ERROR')
  })
})

it('refuses an unknown job', async () => {
  await expect(processWorkspaceIntegrations(job('nope'))).rejects.toThrow(
    'Unknown workspace-integrations job: nope (id=j1)',
  )
  await expect(
    processWorkspaceIntegrations({ name: 'nope', data: {} } as Job),
  ).rejects.toThrow('(id=unknown)')
})
