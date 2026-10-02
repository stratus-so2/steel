import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError, sdIntegrationRequestFailed } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/services/sd-integration-dispatcher', () => ({
  SdIntegrationDispatcher: { deliver: vi.fn(), dispatch: vi.fn() },
}))
vi.mock('@/src/services/sd-github-webhook.service', () => ({
  SdGithubSyncService: { runTick: vi.fn() },
  SdGithubWebhookService: { handle: vi.fn() },
}))

import { ServicedeskIntegrationsJob } from '@/src/lib/queue/jobs'
import { processServicedeskIntegrations } from '@/src/lib/queue/processors/servicedesk-integrations'
import { SdGithubSyncService } from '@/src/services/sd-github-webhook.service'
import { SdIntegrationDispatcher } from '@/src/services/sd-integration-dispatcher'

const dispatcher = vi.mocked(SdIntegrationDispatcher)
const sync = vi.mocked(SdGithubSyncService)

const job = (name: string, data: unknown = {}): Job =>
  ({ id: 'j1', name, data }) as Job

beforeEach(() => {
  dispatcher.deliver.mockResolvedValue(ok('sent'))
  sync.runTick.mockResolvedValue(ok({ checked: 2, updated: 1, failed: 0 }))
})

describe('deliver-event', () => {
  it('delega a entrega ao dispatcher', async () => {
    const data = {
      workspaceId: 'ws1',
      integrationId: 'int-1',
      event: 'sla.breached',
      ticketId: 't1',
      payload: { title: 'SLA violado' },
    }
    const result = await processServicedeskIntegrations(
      job(ServicedeskIntegrationsJob.DeliverEvent, data),
    )
    expect(result).toBe('sent')
    expect(dispatcher.deliver).toHaveBeenCalledWith(data)
  })

  it('lança para a fila tentar de novo quando o Slack falha', async () => {
    dispatcher.deliver.mockResolvedValue(err(sdIntegrationRequestFailed()))
    await expect(
      processServicedeskIntegrations(
        job(ServicedeskIntegrationsJob.DeliverEvent, {
          workspaceId: 'ws1',
          integrationId: 'int-1',
          event: 'sla.breached',
        }),
      ),
    ).rejects.toThrow('SD_INTEGRATION_REQUEST_FAILED')
  })
})

describe('sync-github-state', () => {
  it('reconcilia tudo e também por workspace', async () => {
    expect(
      await processServicedeskIntegrations(
        job(ServicedeskIntegrationsJob.SyncGithubState),
      ),
    ).toEqual({ checked: 2, updated: 1, failed: 0 })
    expect(sync.runTick).toHaveBeenCalledWith(undefined)

    await processServicedeskIntegrations(
      job(ServicedeskIntegrationsJob.SyncGithubState, { workspaceId: 'ws1' }),
    )
    expect(sync.runTick).toHaveBeenLastCalledWith('ws1')
  })

  it('lança quando a reconciliação falha', async () => {
    sync.runTick.mockResolvedValue(err(databaseError()))
    await expect(
      processServicedeskIntegrations(
        job(ServicedeskIntegrationsJob.SyncGithubState),
      ),
    ).rejects.toThrow('DATABASE_ERROR')
  })
})

describe('job desconhecido', () => {
  it('lança com o nome e o id', async () => {
    await expect(
      processServicedeskIntegrations(job('inventado')),
    ).rejects.toThrow('Unknown servicedesk-integrations job: inventado (id=j1)')
  })

  it('lança mesmo sem id do job', async () => {
    await expect(
      processServicedeskIntegrations({ name: 'inventado', data: {} } as Job),
    ).rejects.toThrow('id=unknown')
  })
})
