import { describe, expect, it, vi } from 'vitest'
import {
  seedAiAttachment,
  seedAiConversation,
  seedAiMessage,
} from '@/src/__tests__/factories/steel-ai.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { AiAttachmentRepository } from '../ai-attachment.repository'
import { AiPendingActionRepository } from '../ai-pending-action.repository'
import { AiUsageRepository } from '../ai-settings.repository'

async function context() {
  const [workspace, user, other] = await Promise.all([
    seedWorkspace(),
    seedUser(),
    seedUser(),
  ])
  const conversation = await seedAiConversation(workspace.id, user.id)
  return { workspace, user, other, conversation }
}

describe('AiAttachmentRepository', () => {
  it('should create, find within the conversation and count the unsent', async () => {
    const { workspace, user, conversation } = await context()
    const created = expectOk(
      await AiAttachmentRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        uploadedById: user.id,
        kind: 'IMAGE',
        filename: 'foto.png',
        contentType: 'image/png',
        sizeBytes: 3,
        storageKey: `${workspace.id}/${conversation.id}/x-foto.png`,
      }),
    )
    expect(created.messageId).toBeNull()
    expect(created.extractedText).toBeNull()

    expect(
      expectOk(
        await AiAttachmentRepository.findById(created.id, conversation.id),
      ).filename,
    ).toBe('foto.png')
    expectErr(
      await AiAttachmentRepository.findById(created.id, 'other'),
      'AI_ATTACHMENT_NOT_FOUND',
    )
    expect(
      expectOk(await AiAttachmentRepository.countUnsent(conversation.id)),
    ).toBe(1)
  })

  it('should list only the uploader unsent files and bind them once', async () => {
    const { workspace, user, other, conversation } = await context()
    const mine = await seedAiAttachment(workspace.id, conversation.id, user.id)
    const theirs = await seedAiAttachment(
      workspace.id,
      conversation.id,
      other.id,
    )
    const message = await seedAiMessage(conversation.id)

    const unsent = expectOk(
      await AiAttachmentRepository.listUnsent(
        [mine.id, theirs.id],
        conversation.id,
        user.id,
      ),
    )
    expect(unsent.map((a) => a.id)).toEqual([mine.id])

    expect(
      expectOk(
        await AiAttachmentRepository.attachToMessage([mine.id], message.id),
      ),
    ).toBe(1)
    // Already bound: a second send cannot take it again.
    expect(
      expectOk(
        await AiAttachmentRepository.attachToMessage([mine.id], message.id),
      ),
    ).toBe(0)

    expect(
      expectOk(
        await AiAttachmentRepository.listSentByConversation(conversation.id),
      ).map((a) => a.id),
    ).toEqual([mine.id])
    expect(
      expectOk(
        await AiAttachmentRepository.listByMessageIds([message.id]),
      ).map((a) => a.id),
    ).toEqual([mine.id])
    expect(
      expectOk(await AiAttachmentRepository.listByMessageIds([])),
    ).toEqual([])
  })

  it('should delete only unsent attachments', async () => {
    const { workspace, user, conversation } = await context()
    const loose = await seedAiAttachment(workspace.id, conversation.id, user.id)
    const message = await seedAiMessage(conversation.id)
    const sent = await seedAiAttachment(workspace.id, conversation.id, user.id, {
      messageId: message.id,
    })

    expect(expectOk(await AiAttachmentRepository.deleteUnsent(loose.id))).toBe(
      true,
    )
    expect(expectOk(await AiAttachmentRepository.deleteUnsent(sent.id))).toBe(
      false,
    )
  })

  it('should map database failures', async () => {
    const spy = vi
      .spyOn(prisma.aiAttachment, 'findMany')
      .mockRejectedValue(new Error('down'))
    expectErr(
      await AiAttachmentRepository.listUnsent(['a'], 'c', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiAttachmentRepository.listSentByConversation('c'),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiAttachmentRepository.listByMessageIds(['m']),
      'DATABASE_ERROR',
    )
    spy.mockRestore()

    const spies = [
      vi.spyOn(prisma.aiAttachment, 'create').mockRejectedValue(new Error('x')),
      vi
        .spyOn(prisma.aiAttachment, 'findFirst')
        .mockRejectedValue(new Error('x')),
      vi.spyOn(prisma.aiAttachment, 'count').mockRejectedValue(new Error('x')),
      vi
        .spyOn(prisma.aiAttachment, 'updateMany')
        .mockRejectedValue(new Error('x')),
      vi
        .spyOn(prisma.aiAttachment, 'deleteMany')
        .mockRejectedValue(new Error('x')),
    ]
    expectErr(
      await AiAttachmentRepository.create({
        workspaceId: 'w',
        conversationId: 'c',
        uploadedById: 'u',
        kind: 'DOCUMENT',
        filename: 'f',
        contentType: 'text/plain',
        sizeBytes: 1,
        storageKey: 'k',
      }),
      'DATABASE_ERROR',
    )
    expectErr(await AiAttachmentRepository.findById('a', 'c'), 'DATABASE_ERROR')
    expectErr(await AiAttachmentRepository.countUnsent('c'), 'DATABASE_ERROR')
    expectErr(
      await AiAttachmentRepository.attachToMessage(['a'], 'm'),
      'DATABASE_ERROR',
    )
    expectErr(await AiAttachmentRepository.deleteUnsent('a'), 'DATABASE_ERROR')
    for (const s of spies) s.mockRestore()
  })
})

describe('Steel AI 2 — claimed actions and usage scope', () => {
  it('should create an autopilot action already executed', async () => {
    const { workspace, user, conversation } = await context()
    const now = new Date()
    const action = expectOk(
      await AiPendingActionRepository.create({
        workspaceId: workspace.id,
        requestedById: user.id,
        conversationId: conversation.id,
        toolName: 'crm_delete_task',
        toolCallId: 'call_1',
        kind: 'DELETE',
        module: 'CRM',
        args: {},
        preview: { title: 'Excluir', summary: 'x' },
        requiresDoubleConfirm: true,
        expiresAt: new Date(now.getTime() + 60_000),
        status: 'EXECUTED',
        decidedById: user.id,
        decidedAt: now,
        autoExecuted: true,
      }),
    )
    expect(action).toEqual(
      expect.objectContaining({
        status: 'EXECUTED',
        autoExecuted: true,
        decidedById: user.id,
      }),
    )
    // Never offered for confirmation, so never expired either.
    expect(
      expectOk(
        await AiPendingActionRepository.expireOverdue(
          workspace.id,
          new Date(now.getTime() + 120_000),
        ),
      ),
    ).toBe(0)
  })

  it('should record the usage scope columns', async () => {
    const { workspace, user, conversation } = await context()
    expectOk(
      await AiUsageRepository.record({
        workspaceId: workspace.id,
        userId: user.id,
        feature: 'STEEL_ASSISTANT',
        provider: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.01,
        module: 'SERVICE_DESK',
        conversationId: conversation.id,
        agentRunId: null,
      }),
    )
    const row = await prisma.aiUsage.findFirstOrThrow({
      where: { workspaceId: workspace.id },
    })
    expect(row).toEqual(
      expect.objectContaining({
        module: 'SERVICE_DESK',
        conversationId: conversation.id,
        agentRunId: null,
      }),
    )
  })
})
