import { describe, expect, it, vi } from 'vitest'
import {
  seedCrmAiAttachment,
  seedCrmAiConversation,
  seedCrmAiMessage,
} from '@/src/__tests__/factories/crm-ai.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmAiAttachmentRepository,
  CrmAiConversationRepository,
  CrmAiMessageRepository,
  CrmAiUsageRepository,
} from '../crm-ai.repository'

describe('CrmAiConversationRepository', () => {
  describe('findById()', () => {
    it('should scope by workspace and user', async () => {
      const [workspace, user, other] = await Promise.all([
        seedWorkspace(),
        seedUser(),
        seedUser(),
      ])
      const conversation = await seedCrmAiConversation(workspace.id, user.id)

      expectErr(
        await CrmAiConversationRepository.findById(
          conversation.id,
          workspace.id,
          other.id,
        ),
        'RESOURCE_NOT_FOUND',
      )

      const found = expectOk(
        await CrmAiConversationRepository.findById(
          conversation.id,
          workspace.id,
          user.id,
        ),
      )
      expect(found.id).toBe(conversation.id)
    })
  })
})

describe('CrmAiMessageRepository', () => {
  describe('listByConversation()', () => {
    it('should list messages ordered by createdAt asc', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const conversation = await seedCrmAiConversation(workspace.id, user.id)
      const a = await seedCrmAiMessage(conversation.id, { content: 'A' })
      const b = await seedCrmAiMessage(conversation.id, { content: 'B' })

      const list = expectOk(
        await CrmAiMessageRepository.listByConversation(conversation.id),
      )
      expect(list.map((m) => m.id)).toEqual([a.id, b.id])
    })
  })
})

describe('CrmAiAttachmentRepository', () => {
  describe('findPendingByIds() & attachToMessage()', () => {
    it('should only match unattached rows and link them to a message', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const conversation = await seedCrmAiConversation(workspace.id, user.id)
      const message = await seedCrmAiMessage(conversation.id)
      const pending = await seedCrmAiAttachment(conversation.id)
      const alreadyAttached = await seedCrmAiAttachment(conversation.id, {
        messageId: message.id,
      })

      const found = expectOk(
        await CrmAiAttachmentRepository.findPendingByIds(
          [pending.id, alreadyAttached.id],
          conversation.id,
        ),
      )
      expect(found.map((a) => a.id)).toEqual([pending.id])

      await CrmAiAttachmentRepository.attachToMessage([pending.id], message.id)

      const linked = expectOk(
        await CrmAiAttachmentRepository.listByMessage(message.id),
      )
      expect(linked.map((a) => a.id).sort()).toEqual(
        [pending.id, alreadyAttached.id].sort(),
      )
    })
  })
})

describe('CrmAiConversationRepository (lifecycle)', () => {
  it('should create, list by user newest-updated first, touch and soft delete', async () => {
    const [workspace, other, user, stranger] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    const older = expectOk(
      await CrmAiConversationRepository.create({
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Antiga',
      }),
    )
    const newer = await seedCrmAiConversation(workspace.id, user.id)
    await seedCrmAiConversation(workspace.id, user.id, {
      deletedAt: new Date(),
    })
    await seedCrmAiConversation(workspace.id, stranger.id)
    await seedCrmAiConversation(other.id, user.id)
    await prisma.crmAiConversation.update({
      where: { id: older.id },
      data: { updatedAt: new Date('2020-01-01') },
    })

    const list = expectOk(
      await CrmAiConversationRepository.listByUser(workspace.id, user.id),
    )
    expect(list.map((c) => c.id)).toEqual([newer.id, older.id])

    expectOk(await CrmAiConversationRepository.touch(older.id))
    const touched = expectOk(
      await CrmAiConversationRepository.listByUser(workspace.id, user.id),
    )
    expect(touched[0].id).toBe(older.id)

    expectOk(await CrmAiConversationRepository.softDelete(older.id))
    expectErr(
      await CrmAiConversationRepository.findById(
        older.id,
        workspace.id,
        user.id,
      ),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should return DATABASE_ERROR for failed writes on missing rows', async () => {
    expectErr(
      await CrmAiConversationRepository.create({
        workspaceId: 'missing-workspace',
        userId: 'missing-user',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmAiConversationRepository.touch('missing'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmAiConversationRepository.softDelete('missing'),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when reads throw', async () => {
    vi.spyOn(prisma.crmAiConversation, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmAiConversationRepository.listByUser('ws', 'u'),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma.crmAiConversation, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmAiConversationRepository.findById('c', 'ws', 'u'),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmAiMessageRepository (writes & failures)', () => {
  it('should create a message in the conversation', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const conversation = await seedCrmAiConversation(workspace.id, user.id)

    const message = expectOk(
      await CrmAiMessageRepository.create({
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: 'Resposta',
      }),
    )
    expect(message.role).toBe('ASSISTANT')
    expect(message.conversationId).toBe(conversation.id)
  })

  it('should return DATABASE_ERROR for an unknown conversation', async () => {
    expectErr(
      await CrmAiMessageRepository.create({
        conversationId: 'missing',
        role: 'USER',
        content: 'x',
      }),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when listing throws', async () => {
    vi.spyOn(prisma.crmAiMessage, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmAiMessageRepository.listByConversation('c'),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmAiAttachmentRepository (writes & failures)', () => {
  it('should create a pending attachment', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const conversation = await seedCrmAiConversation(workspace.id, user.id)

    const attachment = expectOk(
      await CrmAiAttachmentRepository.create({
        conversationId: conversation.id,
        kind: 'IMAGE',
        filename: 'a.png',
        contentType: 'image/png',
        sizeBytes: 10,
        storageKey: `${conversation.id}/a.png`,
      }),
    )
    expect(attachment.messageId).toBeNull()
  })

  it('should not return pending attachments of another conversation', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const mine = await seedCrmAiConversation(workspace.id, user.id)
    const theirs = await seedCrmAiConversation(workspace.id, user.id)
    const foreign = await seedCrmAiAttachment(theirs.id)

    expect(
      expectOk(
        await CrmAiAttachmentRepository.findPendingByIds([foreign.id], mine.id),
      ),
    ).toEqual([])
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await CrmAiAttachmentRepository.create({
        conversationId: 'missing',
        kind: 'IMAGE',
        filename: 'a.png',
        contentType: 'image/png',
        sizeBytes: 1,
        storageKey: 'k',
      }),
      'DATABASE_ERROR',
    )

    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const conversation = await seedCrmAiConversation(workspace.id, user.id)
    const pending = await seedCrmAiAttachment(conversation.id)
    expectErr(
      await CrmAiAttachmentRepository.attachToMessage(
        [pending.id],
        'missing-message',
      ),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.crmAiAttachment, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await CrmAiAttachmentRepository.findPendingByIds(['a'], 'c'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmAiAttachmentRepository.listByMessage('m'),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmAiUsageRepository', () => {
  it('should record token usage for the conversation', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const conversation = await seedCrmAiConversation(workspace.id, user.id)

    expectOk(
      await CrmAiUsageRepository.record({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        inputTokens: 100,
        outputTokens: 50,
        model: 'gpt-test',
      }),
    )

    const rows = await prisma.crmAiUsage.findMany({
      where: { workspaceId: workspace.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ inputTokens: 100, outputTokens: 50 })
  })

  it('should return DATABASE_ERROR for an unknown workspace', async () => {
    expectErr(
      await CrmAiUsageRepository.record({
        workspaceId: 'missing',
        conversationId: 'missing',
        inputTokens: 1,
        outputTokens: 1,
        model: 'x',
      }),
      'DATABASE_ERROR',
    )
  })
})
