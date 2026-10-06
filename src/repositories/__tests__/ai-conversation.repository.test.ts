import { describe, expect, it, vi } from 'vitest'
import {
  seedAiConversation,
  seedAiMessage,
} from '@/src/__tests__/factories/steel-ai.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  AiConversationRepository,
  AiMessageRepository,
} from '../ai-conversation.repository'

async function owner() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  return { workspace, user }
}

describe('AiConversationRepository', () => {
  it('should list own conversations, pinned first, filtered by title', async () => {
    const { workspace, user } = await owner()
    const other = await seedUser()
    const old = await seedAiConversation(workspace.id, user.id, {
      title: 'Chamados antigos',
      updatedAt: new Date('2026-01-01'),
    })
    const pinned = await seedAiConversation(workspace.id, user.id, {
      title: 'Leads',
      pinnedAt: new Date('2026-02-01'),
    })
    const recent = await seedAiConversation(workspace.id, user.id, {
      title: 'Chamados de hoje',
    })
    await seedAiConversation(workspace.id, user.id, {
      title: 'Apagada',
      deletedAt: new Date(),
    })
    await seedAiConversation(workspace.id, other.id, { title: 'De outro' })

    const all = expectOk(
      await AiConversationRepository.listByUser(workspace.id, user.id),
    )
    expect(all.map((c) => c.id)).toEqual([pinned.id, recent.id, old.id])

    const filtered = expectOk(
      await AiConversationRepository.listByUser(
        workspace.id,
        user.id,
        'CHAMADOS',
      ),
    )
    expect(filtered.map((c) => c.id)).toEqual([recent.id, old.id])
  })

  it('should scope findById by workspace, owner and soft delete', async () => {
    const { workspace, user } = await owner()
    const stranger = await seedUser()
    const conversation = await seedAiConversation(workspace.id, user.id)

    expect(
      expectOk(
        await AiConversationRepository.findById(
          conversation.id,
          workspace.id,
          user.id,
        ),
      ).id,
    ).toBe(conversation.id)
    expectErr(
      await AiConversationRepository.findById(
        conversation.id,
        workspace.id,
        stranger.id,
      ),
      'AI_CONVERSATION_NOT_FOUND',
    )

    expectOk(await AiConversationRepository.softDelete(conversation.id))
    expectErr(
      await AiConversationRepository.findById(
        conversation.id,
        workspace.id,
        user.id,
      ),
      'AI_CONVERSATION_NOT_FOUND',
    )
  })

  it('should create, update and set the title only while empty', async () => {
    const { workspace, user } = await owner()
    const created = expectOk(
      await AiConversationRepository.create({
        workspaceId: workspace.id,
        userId: user.id,
        mode: 'AGENT',
      }),
    )
    expect(created.mode).toBe('AGENT')
    expect(created.title).toBeNull()

    expect(
      expectOk(await AiConversationRepository.setTitleIfEmpty(created.id, 'A')),
    ).toBe(true)
    expect(
      expectOk(await AiConversationRepository.setTitleIfEmpty(created.id, 'B')),
    ).toBe(false)

    const updated = expectOk(
      await AiConversationRepository.update(created.id, {
        modelKey: 'openai:gpt-4o-mini',
        mode: 'EXPLORE',
      }),
    )
    expect(updated.title).toBe('A')
    expect(updated.modelKey).toBe('openai:gpt-4o-mini')
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await AiConversationRepository.create({
        workspaceId: 'missing',
        userId: 'missing',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiConversationRepository.update('missing', { title: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiConversationRepository.softDelete('missing'),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.aiConversation, 'findMany').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.aiConversation, 'findFirst').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.aiConversation, 'updateMany').mockRejectedValueOnce(
      new Error('down'),
    )
    expectErr(
      await AiConversationRepository.listByUser('w', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiConversationRepository.findById('c', 'w', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiConversationRepository.setTitleIfEmpty('c', 't'),
      'DATABASE_ERROR',
    )
  })
})

describe('AiMessageRepository', () => {
  it('should keep insertion order, list recent rows and count by role', async () => {
    const { workspace, user } = await owner()
    const conversation = await seedAiConversation(workspace.id, user.id)

    expectOk(
      await AiMessageRepository.createMany([
        { conversationId: conversation.id, role: 'USER', content: '1' },
      ]),
    )
    const round = expectOk(
      await AiMessageRepository.createMany([
        {
          id: 'fixed-id',
          conversationId: conversation.id,
          role: 'ASSISTANT',
          content: '2',
          toolCalls: [{ id: 'c1', name: 'x', arguments: {} }],
          raw: { provider: 'openai', content: [] },
          modelKey: 'openai:gpt-4o-mini',
          inputTokens: 10,
          outputTokens: 5,
        },
        {
          conversationId: conversation.id,
          role: 'TOOL',
          content: '3',
          toolCallId: 'c1',
          toolName: 'x',
        },
      ]),
    )
    expect(round[0].id).toBe('fixed-id')
    expect(round[1].createdAt.getTime()).toBeGreaterThan(
      round[0].createdAt.getTime(),
    )

    const all = expectOk(
      await AiMessageRepository.listByConversation(conversation.id),
    )
    expect(all.map((m) => m.content)).toEqual(['1', '2', '3'])

    const recent = expectOk(
      await AiMessageRepository.listRecent(conversation.id, 2),
    )
    expect(recent.map((m) => m.content)).toEqual(['2', '3'])

    expect(
      expectOk(await AiMessageRepository.countByRole(conversation.id, 'USER')),
    ).toBe(1)
  })

  it('should cascade with the conversation and survive seeds', async () => {
    const { workspace, user } = await owner()
    const conversation = await seedAiConversation(workspace.id, user.id)
    await seedAiMessage(conversation.id)
    await prisma.aiConversation.delete({ where: { id: conversation.id } })
    expect(await prisma.aiMessage.count()).toBe(0)
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await AiMessageRepository.createMany([
        { conversationId: 'missing', role: 'USER', content: 'x' },
      ]),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma.aiMessage, 'findMany')
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
    vi.spyOn(prisma.aiMessage, 'count').mockRejectedValueOnce(new Error('down'))
    expectErr(
      await AiMessageRepository.listByConversation('c'),
      'DATABASE_ERROR',
    )
    expectErr(await AiMessageRepository.listRecent('c', 5), 'DATABASE_ERROR')
    expectErr(
      await AiMessageRepository.countByRole('c', 'USER'),
      'DATABASE_ERROR',
    )
  })
})
