import { beforeEach, describe, expect, it, vi } from 'vitest'

const { addMock, loggerMock } = vi.hoisted(() => ({
  addMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/lib/queue/queues', () => ({
  getServicedeskAiQueue: () => ({ add: addMock }),
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { ServicedeskAiJob } from '@/src/lib/queue/jobs'
import {
  enqueueSdAiTriage,
  enqueueSdAiWhatsappReply,
} from '@/src/lib/servicedesk/ai-queue'

const on = { aiEnabled: true, aiAutoTriageEnabled: true }

beforeEach(() => {
  addMock.mockResolvedValue(undefined)
})

describe('enqueueSdAiTriage', () => {
  it('enfileira a triagem com um jobId fixo por chamado', async () => {
    await enqueueSdAiTriage(on, 't1')
    expect(addMock).toHaveBeenCalledWith(
      ServicedeskAiJob.TriageTicket,
      { ticketId: 't1' },
      { jobId: 'triage-t1' },
    )
  })

  it.each([
    ['a IA está desligada', { aiEnabled: false, aiAutoTriageEnabled: true }],
    [
      'a triagem está desligada',
      { aiEnabled: true, aiAutoTriageEnabled: false },
    ],
  ])('não enfileira quando %s', async (_label, settings) => {
    await enqueueSdAiTriage(settings, 't1')
    expect(addMock).not.toHaveBeenCalled()
  })

  it.each([
    [new Error('redis fora'), 'redis fora'],
    ['boom', 'boom'],
  ])(
    'só loga quando a fila falha (a IA é acessória)',
    async (cause, message) => {
      addMock.mockRejectedValue(cause)
      await expect(enqueueSdAiTriage(on, 't1')).resolves.toBeUndefined()
      expect(loggerMock.error).toHaveBeenCalledWith(
        'servicedesk.ai.enqueue_failed',
        expect.objectContaining({ ticketId: 't1', message }),
      )
    },
  )
})

describe('enqueueSdAiWhatsappReply', () => {
  it('enfileira a resposta com um jobId por mensagem', async () => {
    await enqueueSdAiWhatsappReply('conv1', 'msg1')
    expect(addMock).toHaveBeenCalledWith(
      ServicedeskAiJob.WhatsappReply,
      { conversationId: 'conv1', messageId: 'msg1' },
      { jobId: 'wa-reply-msg1' },
    )
  })

  it.each([
    ['boom', 'boom'],
    [new Error('redis fora'), 'redis fora'],
  ])('loga a falha da fila sem lançar', async (cause, message) => {
    addMock.mockRejectedValue(cause)
    await expect(
      enqueueSdAiWhatsappReply('conv1', 'msg1'),
    ).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'servicedesk.ai.enqueue_failed',
      expect.objectContaining({ conversationId: 'conv1', message }),
    )
  })
})
