import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { triageTicketMock, whatsappReplyMock, loggerMock } = vi.hoisted(() => ({
  triageTicketMock: vi.fn(),
  whatsappReplyMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/sd-ai.service', () => ({
  SdAiService: {
    triageTicket: triageTicketMock,
    whatsappReply: whatsappReplyMock,
  },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { ServicedeskAiJob } from '@/src/lib/queue/jobs'
import { processServicedeskAi } from '@/src/lib/queue/processors/servicedesk-ai'

function triageJob(id: string | undefined = 'j1'): Job {
  return {
    id,
    name: ServicedeskAiJob.TriageTicket,
    data: { ticketId: 't1' },
  } as unknown as Job
}

function whatsappJob(): Job {
  return {
    id: 'j2',
    name: ServicedeskAiJob.WhatsappReply,
    data: { conversationId: 'conv1', messageId: 'msg1' },
  } as unknown as Job
}

describe('triagem', () => {
  it('loga o resultado quando o chamado é triado', async () => {
    triageTicketMock.mockResolvedValue({
      ok: true,
      value: {
        status: 'triaged',
        applied: ['categoryId', 'urgencyId'],
        confidence: 0.9,
      },
    })

    await expect(processServicedeskAi(triageJob())).resolves.toBeUndefined()
    expect(triageTicketMock).toHaveBeenCalledWith('t1')
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_ai.triaged',
      expect.objectContaining({
        ticketId: 't1',
        applied: 'categoryId,urgencyId',
        confidence: 0.9,
      }),
    )
  })

  it('loga em info quando pula por regra de negócio', async () => {
    triageTicketMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'already_triaged' },
    })

    await processServicedeskAi(triageJob())
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_ai.triage_skipped',
      expect.objectContaining({ reason: 'already_triaged' }),
    )
    expect(loggerMock.warn).not.toHaveBeenCalled()
  })

  it('sobe para warn quando pula por falta de cota ou provedor', async () => {
    triageTicketMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'ai_quota_exceeded' },
    })

    await processServicedeskAi(triageJob())
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'queue.servicedesk_ai.triage_skipped',
      expect.objectContaining({ reason: 'ai_quota_exceeded' }),
    )
  })

  it('loga erro — sem relançar — quando o provedor falha', async () => {
    triageTicketMock.mockResolvedValue({
      ok: true,
      value: { status: 'failed', reason: 'provider_failed' },
    })

    await expect(processServicedeskAi(triageJob())).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'queue.servicedesk_ai.triage_failed',
      expect.objectContaining({ reason: 'provider_failed' }),
    )
  })

  it('lança para o BullMQ tentar de novo quando o banco falha', async () => {
    triageTicketMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })

    await expect(processServicedeskAi(triageJob())).rejects.toThrow(
      'Falha na triagem por IA: DATABASE_ERROR',
    )
  })
})

describe('resposta no WhatsApp', () => {
  it('loga o desfecho com a ação quando a IA responde', async () => {
    whatsappReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'replied', action: 'answer' },
    })

    await processServicedeskAi(whatsappJob())
    expect(whatsappReplyMock).toHaveBeenCalledWith({
      conversationId: 'conv1',
      messageId: 'msg1',
    })
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_ai.whatsapp',
      expect.objectContaining({ status: 'replied', action: 'answer' }),
    )
  })

  it('loga o motivo quando pula', async () => {
    whatsappReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'human_handling' },
    })

    await processServicedeskAi(whatsappJob())
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_ai.whatsapp',
      expect.objectContaining({ status: 'skipped', reason: 'human_handling' }),
    )
  })

  it('loga erro quando o envio falha', async () => {
    whatsappReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'failed', reason: 'WHATSAPP_SEND_FAILED' },
    })

    await processServicedeskAi(whatsappJob())
    expect(loggerMock.error).toHaveBeenCalledWith(
      'queue.servicedesk_ai.whatsapp_failed',
      expect.objectContaining({ reason: 'WHATSAPP_SEND_FAILED' }),
    )
  })

  it('lança quando o banco falha', async () => {
    whatsappReplyMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })

    await expect(processServicedeskAi(whatsappJob())).rejects.toThrow(
      'Falha na resposta da IA no WhatsApp: DATABASE_ERROR',
    )
  })
})

describe('job desconhecido', () => {
  it('recusa nomes fora da fila, com o id quando existe', async () => {
    await expect(
      processServicedeskAi({
        id: 'j9',
        name: 'nope',
        data: {},
      } as unknown as Job),
    ).rejects.toThrow('Unknown servicedesk-ai job: nope (id=j9)')
  })

  it('cai para "unknown" quando o job não tem id', async () => {
    await expect(
      processServicedeskAi({ name: 'nope', data: {} } as unknown as Job),
    ).rejects.toThrow('Unknown servicedesk-ai job: nope (id=unknown)')
  })
})
