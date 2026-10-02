import { beforeEach, describe, expect, it, vi } from 'vitest'

const { addMock, loggerMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/lib/queue/queues', () => ({
  getServicedeskIntegrationsQueue: () => ({ add: addMock }),
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { ServicedeskIntegrationsJob } from '@/src/lib/queue/jobs'
import {
  enqueueSdGithubStateSync,
  enqueueSdIntegrationEvent,
} from '@/src/lib/servicedesk/integrations-queue'

const event = {
  workspaceId: 'ws1',
  integrationId: 'int-1',
  event: 'sla.breached',
  ticketId: 't1',
  payload: { title: 'SLA violado' },
}

beforeEach(() => {
  addMock.mockResolvedValue(undefined)
})

describe('enqueueSdIntegrationEvent', () => {
  it('enfileira a entrega do evento', async () => {
    await enqueueSdIntegrationEvent(event)
    expect(addMock).toHaveBeenCalledWith(
      ServicedeskIntegrationsJob.DeliverEvent,
      event,
    )
  })

  it('falha ao enfileirar não lança — só vira log', async () => {
    addMock.mockRejectedValue(new Error('redis fora'))
    await expect(enqueueSdIntegrationEvent(event)).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.integration.enqueue_failed',
      expect.objectContaining({ message: 'redis fora' }),
    )
  })

  it('também reporta rejeição que não é Error', async () => {
    addMock.mockRejectedValue('texto cru')
    await expect(enqueueSdIntegrationEvent(event)).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.integration.enqueue_failed',
      expect.objectContaining({ message: 'texto cru' }),
    )
  })
})

describe('enqueueSdGithubStateSync', () => {
  it('enfileira a reconciliação do workspace ou geral', async () => {
    await enqueueSdGithubStateSync('ws1')
    expect(addMock).toHaveBeenLastCalledWith(
      ServicedeskIntegrationsJob.SyncGithubState,
      { workspaceId: 'ws1' },
    )
    await enqueueSdGithubStateSync()
    expect(addMock).toHaveBeenLastCalledWith(
      ServicedeskIntegrationsJob.SyncGithubState,
      {},
    )
  })

  it('falha ao enfileirar não lança, com Error ou não', async () => {
    addMock.mockRejectedValue('texto cru')
    await expect(enqueueSdGithubStateSync('ws1')).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.integration.enqueue_failed',
      expect.objectContaining({ message: 'texto cru' }),
    )

    addMock.mockRejectedValue(new Error('redis fora'))
    await expect(enqueueSdGithubStateSync()).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenLastCalledWith(
      'servicedesk.integration.enqueue_failed',
      expect.objectContaining({ message: 'redis fora' }),
    )
  })
})
