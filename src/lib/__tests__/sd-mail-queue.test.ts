import { beforeEach, describe, expect, it, vi } from 'vitest'

const { addMock, loggerMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/lib/queue/queues', () => ({
  getServicedeskMailQueue: () => ({ add: addMock }),
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { ServicedeskMailJob } from '@/src/lib/queue/jobs'
import { enqueueSdMailboxSync } from '@/src/lib/servicedesk/mail-queue'

beforeEach(() => {
  vi.clearAllMocks()
  addMock.mockResolvedValue(undefined)
})

describe('enqueueSdMailboxSync', () => {
  it('enfileira a leitura de uma caixa com um jobId único', async () => {
    await enqueueSdMailboxSync('mb1')
    expect(addMock).toHaveBeenCalledWith(
      ServicedeskMailJob.SyncMailbox,
      { mailboxId: 'mb1' },
      { jobId: expect.stringContaining('mailbox-sync-mb1-') },
    )
  })

  it.each([
    [new Error('redis fora'), 'redis fora'],
    ['boom', 'boom'],
  ])(
    'só loga quando a fila falha (o tick lê de todo jeito)',
    async (cause, message) => {
      addMock.mockRejectedValue(cause)
      await expect(enqueueSdMailboxSync('mb1')).resolves.toBeUndefined()
      expect(loggerMock.error).toHaveBeenCalledWith(
        'servicedesk.mail.enqueue_failed',
        expect.objectContaining({ mailboxId: 'mb1', message }),
      )
    },
  )
})
