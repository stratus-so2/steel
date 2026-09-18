import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmAiAttachment,
  createFakeCrmAiConversation,
  createFakeCrmAiMessage,
} from '@/src/__tests__/factories/crm-ai.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, featureNotEnabled, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/services/feature-flag.service')
vi.mock('@/src/repositories/crm-ai.repository')
vi.mock('@/src/services/ai-usage.service')
vi.mock('@/src/lib/storage/s3')
vi.mock('@/src/services/crm-ai-tools', () => ({
  CRM_AI_TOOLS: [],
  executeAiTool: vi.fn(async () => '{"total":3}'),
}))

import { aiProviderUnavailable, aiQuotaExceeded } from '@/src/errors'
import type { AiChatResponse, AiProvider } from '@/src/lib/ai/types'
import {
  ensureBucket,
  getPresignedDownloadUrl,
  putObject,
} from '@/src/lib/storage/s3'
import {
  CrmAiAttachmentRepository,
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
const mockedAttachmentRepo = vi.mocked(CrmAiAttachmentRepository)
const mockedPresign = vi.mocked(getPresignedDownloadUrl)
const mockedPutObject = vi.mocked(putObject)
const mockedEnsureBucket = vi.mocked(ensureBucket)
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

describe('CrmAiConversationService (extended)', () => {
  function asMember() {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
  }

  function stubHappyPersistence(userMessage = createFakeCrmAiMessage()) {
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
  }

  describe('list()', () => {
    it('should propagate a repository error', async () => {
      asMember()
      mockedConversationRepo.listByUser.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(
        await CrmAiConversationService.list('u1', 'ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmAiConversationService.create('u1', 'ws1', { title: 'x' }),
        'FORBIDDEN',
      )
    })

    it('should create the conversation owned by the actor', async () => {
      asMember()
      mockedConversationRepo.create.mockResolvedValue(
        ok(createFakeCrmAiConversation({ id: 'c9', title: 'Nova' })),
      )
      const dto = expectOk(
        await CrmAiConversationService.create('u1', 'ws1', { title: 'Nova' }),
      )
      expect(dto.id).toBe('c9')
      expect(mockedConversationRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        userId: 'u1',
        title: 'Nova',
      })
    })

    it('should propagate a repository error', async () => {
      asMember()
      mockedConversationRepo.create.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(
        await CrmAiConversationService.create('u1', 'ws1', { title: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listMessages()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmAiConversationService.listMessages('u1', 'ws1', 'c1'),
        'FORBIDDEN',
      )
    })

    it('should return NOT_FOUND when the conversation belongs to someone else', async () => {
      asMember()
      mockedConversationRepo.findById.mockResolvedValue(
        err(notFound('Conversa')),
      )
      expectErr(
        await CrmAiConversationService.listMessages('u1', 'ws1', 'c1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedMessageRepo.listByConversation).not.toHaveBeenCalled()
    })

    it('should propagate a message repository error', async () => {
      asMemberWithConversation()
      mockedMessageRepo.listByConversation.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(
        await CrmAiConversationService.listMessages('u1', 'ws1', 'c1'),
        'DATABASE_ERROR',
      )
    })

    it('should attach signed urls only to messages that have attachments', async () => {
      asMemberWithConversation()
      const withFile = createFakeCrmAiMessage({ id: 'm1' })
      const plain = createFakeCrmAiMessage({ id: 'm2' })
      const broken = createFakeCrmAiMessage({ id: 'm3' })
      mockedMessageRepo.listByConversation.mockResolvedValue(
        ok([withFile, plain, broken]),
      )
      const attachment = createFakeCrmAiAttachment({
        messageId: 'm1',
        storageKey: 'c1/a.jpg',
      })
      mockedAttachmentRepo.listByMessage.mockImplementation(async (id) => {
        if (id === 'm1') return ok([attachment])
        if (id === 'm2') return ok([])
        return err(databaseError('boom'))
      })
      mockedPresign.mockResolvedValue('https://signed/a.jpg')

      const dtos = expectOk(
        await CrmAiConversationService.listMessages('u1', 'ws1', 'c1'),
      )

      expect(dtos[0].attachments).toEqual([
        expect.objectContaining({
          id: attachment.id,
          url: 'https://signed/a.jpg',
        }),
      ])
      expect(dtos[1].attachments).toBeUndefined()
      expect(dtos[2].attachments).toBeUndefined()
      expect(mockedPresign).toHaveBeenCalledWith(
        expect.objectContaining({
          bucket: 'crm-ai-attachments',
          key: 'c1/a.jpg',
        }),
      )
    })
  })

  describe('sendMessage()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'FORBIDDEN',
      )
    })

    it('should return NOT_FOUND for a conversation of another user', async () => {
      asMember()
      mockedConversationRepo.findById.mockResolvedValue(
        err(notFound('Conversa')),
      )
      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedAiUsage.prepare).not.toHaveBeenCalled()
    })

    it('should propagate a failure storing the user message', async () => {
      asMemberWithConversation()
      mockedAiUsage.prepare.mockResolvedValue(
        ok(preparedCall(vi.fn<AiProvider['chat']>())),
      )
      mockedMessageRepo.create.mockResolvedValue(err(databaseError('boom')))
      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'DATABASE_ERROR',
      )
    })

    it('should propagate a failure loading pending attachments', async () => {
      asMemberWithConversation()
      mockedAiUsage.prepare.mockResolvedValue(
        ok(preparedCall(vi.fn<AiProvider['chat']>())),
      )
      mockedMessageRepo.create.mockResolvedValue(
        ok(createFakeCrmAiMessage({ id: 'm1' })),
      )
      mockedAttachmentRepo.findPendingByIds.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
          attachmentIds: ['a1'],
        }),
        'DATABASE_ERROR',
      )
      expect(mockedAttachmentRepo.attachToMessage).not.toHaveBeenCalled()
    })

    it('should send image attachments as multimodal content of the new message', async () => {
      asMemberWithConversation()
      const previous = createFakeCrmAiMessage({
        id: 'm0',
        role: 'ASSISTANT',
        content: 'Olá!',
      })
      const userMessage = createFakeCrmAiMessage({
        id: 'm1',
        role: 'USER',
        content: 'Veja a foto',
      })
      stubHappyPersistence(userMessage)
      mockedMessageRepo.listByConversation.mockResolvedValue(
        ok([previous, userMessage]),
      )
      const image = createFakeCrmAiAttachment({
        id: 'a1',
        kind: 'IMAGE',
        storageKey: 'c1/a1.jpg',
      })
      const pdf = createFakeCrmAiAttachment({
        id: 'a2',
        kind: 'DOCUMENT',
        storageKey: 'c1/a2.pdf',
      })
      mockedAttachmentRepo.findPendingByIds.mockResolvedValue(ok([image, pdf]))
      mockedAttachmentRepo.attachToMessage.mockResolvedValue(ok(undefined))
      mockedPresign.mockResolvedValue('https://signed/a1.jpg')
      const chat = vi
        .fn<AiProvider['chat']>()
        .mockResolvedValue(response({ text: 'Bonita foto.' }))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      const dto = expectOk(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Veja a foto',
          attachmentIds: ['a1', 'a2'],
        }),
      )

      expect(dto.content).toBe('Bonita foto.')
      expect(mockedAttachmentRepo.attachToMessage).toHaveBeenCalledWith(
        ['a1', 'a2'],
        'm1',
      )
      expect(mockedPresign).toHaveBeenCalledTimes(1)
      expect(chat.mock.calls[0][0].messages).toEqual([
        { role: 'assistant', content: 'Olá!' },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Veja a foto' },
            { type: 'image', url: 'https://signed/a1.jpg' },
          ],
        },
      ])
      expect(mockedConversationRepo.touch).toHaveBeenCalledWith('c1')
      expect(mockedUsageRepo.record).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        conversationId: 'c1',
        inputTokens: 100,
        outputTokens: 20,
        model: 'claude-sonnet-5',
      })
    })

    it('should send plain text when attachments are only documents', async () => {
      asMemberWithConversation()
      const userMessage = createFakeCrmAiMessage({ id: 'm1', content: 'Doc' })
      stubHappyPersistence(userMessage)
      mockedAttachmentRepo.findPendingByIds.mockResolvedValue(
        ok([createFakeCrmAiAttachment({ kind: 'DOCUMENT' })]),
      )
      const chat = vi
        .fn<AiProvider['chat']>()
        .mockResolvedValue(response({ text: 'Ok' }))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      expectOk(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Doc',
          attachmentIds: ['a1'],
        }),
      )
      expect(chat.mock.calls[0][0].messages).toEqual([
        { role: 'user', content: 'Doc' },
      ])
    })

    it('should propagate a failure loading the history', async () => {
      asMemberWithConversation()
      mockedAiUsage.prepare.mockResolvedValue(
        ok(preparedCall(vi.fn<AiProvider['chat']>())),
      )
      mockedMessageRepo.create.mockResolvedValue(ok(createFakeCrmAiMessage()))
      mockedMessageRepo.listByConversation.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'DATABASE_ERROR',
      )
    })

    it('should only send the last 20 messages of history', async () => {
      asMemberWithConversation()
      const history = Array.from({ length: 25 }, (_, i) =>
        createFakeCrmAiMessage({ id: `h${i}`, content: `msg ${i}` }),
      )
      stubHappyPersistence(history[24])
      mockedMessageRepo.listByConversation.mockResolvedValue(ok(history))
      const chat = vi
        .fn<AiProvider['chat']>()
        .mockResolvedValue(response({ text: 'Ok' }))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      expectOk(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'msg 24',
        }),
      )
      const sent = chat.mock.calls[0][0].messages
      expect(sent).toHaveLength(20)
      expect(sent[0]).toEqual({ role: 'user', content: 'msg 5' })
    })

    it('should reply with the refusal text when the model refuses without text', async () => {
      asMemberWithConversation()
      stubHappyPersistence()
      const chat = vi
        .fn<AiProvider['chat']>()
        .mockResolvedValue(response({ stopReason: 'refusal' }))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      const dto = expectOk(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
      )
      expect(dto.content).toBe(
        'Não posso ajudar com esse pedido. Tente reformular a pergunta.',
      )
    })

    it('should fall back to the default reply when the model returns empty text', async () => {
      asMemberWithConversation()
      stubHappyPersistence()
      const chat = vi.fn<AiProvider['chat']>().mockResolvedValue(response({}))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      const dto = expectOk(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
      )
      expect(dto.content).toBe('Não consegui gerar uma resposta agora.')
    })

    it('should stop after the max tool rounds with an explanatory reply', async () => {
      asMemberWithConversation()
      stubHappyPersistence()
      const chat = vi.fn<AiProvider['chat']>().mockResolvedValue(
        response({
          stopReason: 'tool_use',
          toolCalls: [{ id: 't', name: 'list_leads', arguments: {} }],
        }),
      )
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      const dto = expectOk(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
      )
      expect(chat).toHaveBeenCalledTimes(6)
      expect(executeAiTool).toHaveBeenCalledTimes(6)
      expect(dto.content).toMatch(/mais etapas do que o permitido/)
      expect(mockedAiUsage.record).toHaveBeenCalledWith(expect.anything(), {
        workspaceId: 'ws1',
        userId: 'u1',
        usage: { inputTokens: 600, outputTokens: 120 },
      })
    })

    it('should report non-Error provider failures as AI_PROVIDER_UNAVAILABLE', async () => {
      asMemberWithConversation()
      stubHappyPersistence()
      const chat = vi.fn<AiProvider['chat']>().mockRejectedValue('timeout')
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'AI_PROVIDER_UNAVAILABLE',
      )
      // Só a mensagem do usuário foi gravada — nenhuma resposta do assistente.
      expect(mockedMessageRepo.create).toHaveBeenCalledTimes(1)
    })

    it('should propagate a failure storing the assistant reply', async () => {
      asMemberWithConversation()
      const userMessage = createFakeCrmAiMessage({ id: 'm1' })
      mockedMessageRepo.create.mockImplementation(async (data) =>
        data.role === 'USER' ? ok(userMessage) : err(databaseError('boom')),
      )
      mockedMessageRepo.listByConversation.mockResolvedValue(ok([userMessage]))
      const chat = vi
        .fn<AiProvider['chat']>()
        .mockResolvedValue(response({ text: 'Oi' }))
      mockedAiUsage.prepare.mockResolvedValue(ok(preparedCall(chat)))

      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', {
          content: 'Oi',
        }),
        'DATABASE_ERROR',
      )
      expect(mockedAiUsage.record).not.toHaveBeenCalled()
    })
  })

  describe('remove()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmAiConversationService.remove('u1', 'ws1', 'c1'),
        'FORBIDDEN',
      )
    })

    it('should return NOT_FOUND for a conversation of another user', async () => {
      asMember()
      mockedConversationRepo.findById.mockResolvedValue(
        err(notFound('Conversa')),
      )
      expectErr(
        await CrmAiConversationService.remove('u1', 'ws1', 'c1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedConversationRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should soft-delete the conversation', async () => {
      asMemberWithConversation()
      mockedConversationRepo.softDelete.mockResolvedValue(ok(undefined))
      expectOk(await CrmAiConversationService.remove('u1', 'ws1', 'c1'))
      expect(mockedConversationRepo.softDelete).toHaveBeenCalledWith('c1')
    })

    it('should propagate a soft-delete failure', async () => {
      asMemberWithConversation()
      mockedConversationRepo.softDelete.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(
        await CrmAiConversationService.remove('u1', 'ws1', 'c1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('uploadAttachment()', () => {
    const readBody = vi.fn(async () => Buffer.from('img'))
    const input = {
      contentType: 'image/png',
      byteSize: 1024,
      filename: 'foto.png',
      readBody,
    }

    beforeEach(() => {
      mockedEnsureBucket.mockResolvedValue(undefined)
      mockedPutObject.mockResolvedValue(undefined)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmAiConversationService.uploadAttachment(
          'u1',
          'ws1',
          'c1',
          input,
        ),
        'FORBIDDEN',
      )
    })

    it('should block when the feature is off', async () => {
      asMember()
      mockedAssertFeature.mockResolvedValue(err(featureNotEnabled()))
      expectErr(
        await CrmAiConversationService.uploadAttachment(
          'u1',
          'ws1',
          'c1',
          input,
        ),
        'FEATURE_NOT_ENABLED',
      )
    })

    it('should return NOT_FOUND for a conversation of another user', async () => {
      asMember()
      mockedConversationRepo.findById.mockResolvedValue(
        err(notFound('Conversa')),
      )
      expectErr(
        await CrmAiConversationService.uploadAttachment(
          'u1',
          'ws1',
          'c1',
          input,
        ),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should reject an unsupported format without reading the body', async () => {
      asMemberWithConversation()
      expectErr(
        await CrmAiConversationService.uploadAttachment('u1', 'ws1', 'c1', {
          ...input,
          contentType: 'video/mp4',
        }),
        'VALIDATION_ERROR',
      )
      expect(readBody).not.toHaveBeenCalled()
    })

    it('should return STORAGE_ERROR when the upload fails', async () => {
      asMemberWithConversation()
      mockedPutObject.mockRejectedValue(new Error('s3 down'))
      expectErr(
        await CrmAiConversationService.uploadAttachment(
          'u1',
          'ws1',
          'c1',
          input,
        ),
        'STORAGE_ERROR',
      )
      expect(mockedAttachmentRepo.create).not.toHaveBeenCalled()
    })

    it('should return STORAGE_ERROR when the bucket check throws a non-Error', async () => {
      asMemberWithConversation()
      mockedEnsureBucket.mockRejectedValue('no bucket')
      expectErr(
        await CrmAiConversationService.uploadAttachment(
          'u1',
          'ws1',
          'c1',
          input,
        ),
        'STORAGE_ERROR',
      )
      expect(mockedPutObject).not.toHaveBeenCalled()
    })

    it('should propagate a failure persisting the attachment row', async () => {
      asMemberWithConversation()
      mockedAttachmentRepo.create.mockResolvedValue(err(databaseError('boom')))
      expectErr(
        await CrmAiConversationService.uploadAttachment(
          'u1',
          'ws1',
          'c1',
          input,
        ),
        'DATABASE_ERROR',
      )
    })

    it('should store the file and return the attachment with a signed url', async () => {
      asMemberWithConversation()
      mockedAttachmentRepo.create.mockImplementation(async (data) =>
        ok(createFakeCrmAiAttachment({ ...data, id: 'a1' })),
      )
      mockedPresign.mockResolvedValue('https://signed/x.png')

      const dto = expectOk(
        await CrmAiConversationService.uploadAttachment(
          'u1',
          'ws1',
          'c1',
          input,
        ),
      )

      expect(dto).toEqual(
        expect.objectContaining({
          id: 'a1',
          kind: 'IMAGE',
          url: 'https://signed/x.png',
        }),
      )
      expect(mockedEnsureBucket).toHaveBeenCalledWith('crm-ai-attachments')
      const put = mockedPutObject.mock.calls[0][0]
      expect(put.key).toMatch(/^c1\/.+\.png$/)
      expect(put.contentType).toBe('image/png')
      expect(mockedAttachmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 'c1',
          kind: 'IMAGE',
          sizeBytes: 1024,
          storageKey: put.key,
        }),
      )
    })
  })
})
