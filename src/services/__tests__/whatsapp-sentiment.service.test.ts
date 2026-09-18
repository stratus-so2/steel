import { describe, expect, it, vi } from 'vitest'
import { createFakeWhatsAppAiConfig } from '@/src/__tests__/factories/whatsapp-ai-config.factory'
import { createFakeWhatsAppConversation } from '@/src/__tests__/factories/whatsapp-conversation.factory'
import { createFakeWhatsAppMessage } from '@/src/__tests__/factories/whatsapp-message.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/whatsapp-ai-config.repository')
vi.mock('@/src/repositories/whatsapp-conversation.repository')
vi.mock('@/src/repositories/whatsapp-message.repository')
vi.mock('@/src/services/ai-usage.service')
vi.mock('@/src/services/whatsapp-sentiment-alert.service')

import { aiQuotaExceeded, databaseError } from '@/src/errors'
import type { AiChatResponse, AiProvider } from '@/src/lib/ai/types'
import { WhatsAppAiConfigRepository } from '@/src/repositories/whatsapp-ai-config.repository'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppMessageRepository } from '@/src/repositories/whatsapp-message.repository'
import {
  AiUsageService,
  type PreparedAiCall,
} from '@/src/services/ai-usage.service'
import { WhatsAppSentimentAlertService } from '@/src/services/whatsapp-sentiment-alert.service'
import {
  parseSentimentResponse,
  WhatsAppSentimentService,
} from '../whatsapp-sentiment.service'

const mockedMessageRepo = vi.mocked(WhatsAppMessageRepository)
const mockedConversationRepo = vi.mocked(WhatsAppConversationRepository)
const mockedAiConfigRepo = vi.mocked(WhatsAppAiConfigRepository)
const mockedAiUsage = vi.mocked(AiUsageService)
const mockedAlert = vi.mocked(WhatsAppSentimentAlertService)

function preparedCall(chat: AiProvider['chat']): PreparedAiCall {
  return {
    feature: 'WHATSAPP_SENTIMENT',
    provider: { id: 'openai', chat },
    model: {
      key: 'openai:gpt-4o-mini',
      provider: 'openai',
      model: 'gpt-4o-mini',
      label: 'GPT-4o mini',
    },
    usdPer1kTokens: 4,
  }
}

function response(text: string): AiChatResponse {
  return {
    text,
    toolCalls: [],
    message: { role: 'assistant', content: text },
    usage: { inputTokens: 10, outputTokens: 5 },
    stopReason: 'end',
  }
}

function arrangeMessage(
  overrides?: Parameters<typeof createFakeWhatsAppMessage>[0],
) {
  mockedMessageRepo.findById.mockResolvedValue(
    ok(
      createFakeWhatsAppMessage({
        id: 'm1',
        workspaceId: 'ws1',
        conversationId: 'conv1',
        text: 'Estou muito irritado',
        ...overrides,
      }),
    ),
  )
  mockedAiConfigRepo.findByWorkspace.mockResolvedValue(
    ok(createFakeWhatsAppAiConfig({ workspaceId: 'ws1' })),
  )
}

describe('parseSentimentResponse()', () => {
  it('should clamp the score to [-1, 1]', () => {
    expect(
      parseSentimentResponse('{"sentiment":"NEGATIVE","score":-3}'),
    ).toEqual({ sentiment: 'NEGATIVE', score: -1 })
  })

  it('should return null for invalid payloads', () => {
    expect(parseSentimentResponse('not json')).toBeNull()
    expect(parseSentimentResponse('{"sentiment":"ANGRY","score":0}')).toBeNull()
  })
})

describe('WhatsAppSentimentService.analyzeMessage()', () => {
  it('should skip a missing message', async () => {
    mockedMessageRepo.findById.mockResolvedValue(ok(null))
    expect(
      expectOk(await WhatsAppSentimentService.analyzeMessage('m1')),
    ).toEqual({ status: 'skipped', reason: 'message_not_found' })
  })

  it('should skip outbound messages', async () => {
    arrangeMessage({ direction: 'OUT' })
    expect(
      expectOk(await WhatsAppSentimentService.analyzeMessage('m1')),
    ).toEqual({ status: 'skipped', reason: 'not_inbound' })
  })

  it('should skip messages without text', async () => {
    arrangeMessage({ text: '   ' })
    expect(
      expectOk(await WhatsAppSentimentService.analyzeMessage('m1')),
    ).toEqual({ status: 'skipped', reason: 'no_text' })
  })

  it('should skip when the workspace has no AI config', async () => {
    arrangeMessage()
    mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))
    expect(
      expectOk(await WhatsAppSentimentService.analyzeMessage('m1')),
    ).toEqual({ status: 'skipped', reason: 'no_ai_config' })
  })

  it('should skip when the AI quota is exhausted', async () => {
    arrangeMessage()
    mockedAiUsage.prepare.mockResolvedValue(err(aiQuotaExceeded(1, 1)))
    expect(
      expectOk(await WhatsAppSentimentService.analyzeMessage('m1')),
    ).toEqual({ status: 'skipped', reason: 'ai_quota_exceeded' })
  })

  it('should classify, persist and recompute the conversation average', async () => {
    arrangeMessage()
    mockedAiUsage.prepare.mockResolvedValue(
      ok(
        preparedCall(
          vi.fn(async () => response('{"sentiment":"NEGATIVE","score":-0.8}')),
        ),
      ),
    )
    mockedMessageRepo.update.mockResolvedValue(ok(createFakeWhatsAppMessage()))
    mockedMessageRepo.listRecentSentimentScores.mockResolvedValue(
      ok([-0.8, 0.2]),
    )
    mockedConversationRepo.update.mockResolvedValue(
      ok(createFakeWhatsAppConversation()),
    )
    mockedAlert.evaluate.mockResolvedValue(
      ok({ alerted: false, reason: 'above_threshold' }),
    )

    const outcome = expectOk(
      await WhatsAppSentimentService.analyzeMessage('m1'),
    )

    expect(outcome).toEqual({
      status: 'classified',
      sentiment: 'NEGATIVE',
      score: -0.8,
      conversationId: 'conv1',
      workspaceId: 'ws1',
      avgSentimentScore: expect.closeTo(-0.3),
      alert: { alerted: false, reason: 'above_threshold' },
    })
    expect(mockedAlert.evaluate).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      conversationId: 'conv1',
      avgSentimentScore: expect.closeTo(-0.3),
    })
    expect(mockedAiUsage.prepare).toHaveBeenCalledWith(
      'ws1',
      'WHATSAPP_SENTIMENT',
    )
    expect(mockedMessageRepo.update).toHaveBeenCalledWith('m1', {
      sentiment: 'NEGATIVE',
      sentimentScore: -0.8,
    })
    expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
      avgSentimentScore: expect.closeTo(-0.3),
    })
    expect(mockedAiUsage.record).toHaveBeenCalled()
  })

  it('should skip an unparseable model answer without persisting', async () => {
    arrangeMessage()
    mockedAiUsage.prepare.mockResolvedValue(
      ok(preparedCall(vi.fn(async () => response('???')))),
    )

    expect(
      expectOk(await WhatsAppSentimentService.analyzeMessage('m1')),
    ).toEqual({ status: 'skipped', reason: 'unparseable_response' })
    expect(mockedMessageRepo.update).not.toHaveBeenCalled()
  })

  it('should report provider failures without throwing', async () => {
    arrangeMessage()
    mockedAiUsage.prepare.mockResolvedValue(
      ok(
        preparedCall(
          vi.fn(async () => {
            throw new Error('timeout')
          }),
        ),
      ),
    )

    expect(
      expectOk(await WhatsAppSentimentService.analyzeMessage('m1')),
    ).toEqual(
      expect.objectContaining({
        status: 'failed',
        reason: 'provider_failed',
        detail: 'timeout',
      }),
    )
  })

  it('should propagate database errors', async () => {
    mockedMessageRepo.findById.mockResolvedValue(err(databaseError('down')))
    expectErr(
      await WhatsAppSentimentService.analyzeMessage('m1'),
      'DATABASE_ERROR',
    )
  })
})
