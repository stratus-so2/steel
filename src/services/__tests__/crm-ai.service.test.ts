import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmAiConversation,
  createFakeCrmAiMessage,
} from '@/src/__tests__/factories/crm-ai.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { featureNotEnabled } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/services/feature-flag.service')
vi.mock('@/src/repositories/crm-ai.repository')
vi.mock('@/src/services/ai-usage.service')
vi.mock('@/src/services/crm-ai-tools', () => ({
  CRM_AI_TOOLS: [],
  executeAiTool: vi.fn(async () => '{"total":3}'),
}))

import { aiProviderUnavailable, aiQuotaExceeded } from '@/src/errors'
import type { AiChatResponse, AiProvider } from '@/src/lib/ai/types'
import {
  CrmAiConversationRepository,
  CrmAiMessageRepository,
  CrmAiUsageRepository,
} from '@/src/repositories/crm-ai.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  AiUsageService,
  type PreparedAiCall,
} from '@/src/services/ai-usage.service'
import { executeAiTool } from '@/src/services/crm-ai-tools'
import { CrmAiConversationService } from '../crm-ai.service'
import { assertFeature } from '../feature-flag.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConversationRepo = vi.mocked(CrmAiConversationRepository)
const mockedMessageRepo = vi.mocked(CrmAiMessageRepository)
const mockedUsageRepo = vi.mocked(CrmAiUsageRepository)
const mockedAiUsage = vi.mocked(AiUsageService)
const mockedAssertFeature = vi.mocked(assertFeature)

beforeEach(() => {
  mockedAssertFeature.mockResolvedValue(ok(true))
})

function asMemberWithConversation() {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
  mockedConversationRepo.findById.mockResolvedValue(
    ok(createFakeCrmAiConversation({ id: 'c1' })),
  )
}

function response(overrides: Partial<AiChatResponse>): AiChatResponse {
  return {
    text: '',
    toolCalls: [],
    message: { role: 'assistant', content: overrides.text ?? '' },
    usage: { inputTokens: 100, outputTokens: 20 },
    stopReason: 'end',
    ...overrides,
  }
}

function preparedCall(chat: AiProvider['chat']): PreparedAiCall {
  return {
    feature: 'CRM_ASSISTANT',
    provider: { id: 'anthropic', chat },
    model: {
      key: 'anthropic:claude-sonnet-5',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      label: 'Claude Sonnet 5',
    },
    usdPer1kTokens: 4,
  }
}

describe('CrmAiConversationService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmAiConversationService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return conversations for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.listByUser.mockResolvedValue(
        ok([createFakeCrmAiConversation({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmAiConversationService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })
  })

  describe('sendMessage()', () => {
    it('should return AI_PROVIDER_UNAVAILABLE when no provider key is configured', async () => {
      asMemberWithConversation()
      mockedAiUsage.prepare.mockResolvedValue(err(aiProviderUnavailable()))

      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'AI_PROVIDER_UNAVAILABLE',
      )
    })

    it('should block with AI_QUOTA_EXCEEDED before storing the message', async () => {
      asMemberWithConversation()
      mockedAiUsage.prepare.mockResolvedValue(err(aiQuotaExceeded(50, 50)))

      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'AI_QUOTA_EXCEEDED',
      )
      expect(mockedAiUsage.prepare).toHaveBeenCalledWith(
        'ws1',
        'CRM_ASSISTANT',
        'u1',
      )
      expect(mockedMessageRepo.create).not.toHaveBeenCalled()
    })

    it('should run the tool loop on the resolved provider and record usage', async () => {
      asMemberWithConversation()
      const userMessage = createFakeCrmAiMessage({
        id: 'm1',
        conversationId: 'c1',
        role: 'USER',
        content: 'Quantos leads?',
      })
      mockedMessageRepo.create.mockImplementation(async (data) =>
        ok(
          data.role === 'USER'
            ? userMessage
            : createFakeCrmAiMessage({
                role: 'ASSISTANT',
                content: data.content,
              }),
        ),
      )
      mockedMessageRepo.listByConversation.mockResolvedValue(ok([userMessage]))
      mockedUsageRepo.record.mockResolvedValue(ok(undefined))
      mockedConversationRepo.touch.mockResolvedValue(ok(undefined))

      const toolTurn = response({
        stopReason: 'tool_use',
        toolCalls: [{ id: 't1', name: 'list_leads', arguments: {} }],
      })
      const chat = vi
        .fn<AiProvider['chat']>()
        .mockResolvedValueOnce(toolTurn)
        .mockResolvedValueOnce(response({ text: 'Você tem 3 leads.' }))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      const dto = expectOk(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Quantos leads?',
        }),
      )

      expect(dto.content).toBe('Você tem 3 leads.')
      expect(chat).toHaveBeenCalledTimes(2)
      expect(chat.mock.calls[0][0]).toEqual(
        expect.objectContaining({ model: 'claude-sonnet-5', webSearch: true }),
      )
      expect(executeAiTool).toHaveBeenCalledWith(
        'list_leads',
        {},
        { actorId: 'u1', workspaceId: 'ws1' },
      )
      expect(chat.mock.calls[1][0].messages.slice(-2)).toEqual([
        toolTurn.message,
        {
          role: 'tool',
          toolCallId: 't1',
          name: 'list_leads',
          content: '{"total":3}',
        },
      ])
      expect(mockedAiUsage.record).toHaveBeenCalledWith(
        expect.objectContaining({ feature: 'CRM_ASSISTANT' }),
        {
          workspaceId: 'ws1',
          userId: 'u1',
          usage: { inputTokens: 200, outputTokens: 40 },
        },
      )
    })

    it('should record partial usage and return AI_PROVIDER_UNAVAILABLE when the provider fails', async () => {
      asMemberWithConversation()
      const userMessage = createFakeCrmAiMessage({ id: 'm1', role: 'USER' })
      mockedMessageRepo.create.mockResolvedValue(ok(userMessage))
      mockedMessageRepo.listByConversation.mockResolvedValue(ok([userMessage]))
      const chat = vi
        .fn<AiProvider['chat']>()
        .mockRejectedValue(new Error('overloaded'))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'AI_PROVIDER_UNAVAILABLE',
      )
      expect(mockedAiUsage.record).toHaveBeenCalled()
    })
  })

  describe('feature flag crm.aiAssistant', () => {
    beforeEach(() => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedAssertFeature.mockResolvedValue(err(featureNotEnabled()))
    })

    it('should block create() when the feature is off for the workspace', async () => {
      expectErr(
        await CrmAiConversationService.create('u1', 'ws1', { title: 'Nova' }),
        'FEATURE_NOT_ENABLED',
      )
      expect(mockedAssertFeature).toHaveBeenCalledWith('ws1', 'crm.aiAssistant')
      expect(mockedConversationRepo.create).not.toHaveBeenCalled()
    })

    it('should block sendMessage() when the feature is off for the workspace', async () => {
      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'FEATURE_NOT_ENABLED',
      )
      expect(mockedConversationRepo.findById).not.toHaveBeenCalled()
    })

    it('should still list past conversations when the feature is off', async () => {
      mockedConversationRepo.listByUser.mockResolvedValue(ok([]))
      expectOk(await CrmAiConversationService.list('u1', 'ws1'))
    })
  })
})
