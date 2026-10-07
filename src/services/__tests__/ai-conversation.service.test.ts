import { describe, expect, it, vi } from 'vitest'
import { createFakeWorkspaceAiSettings } from '@/src/__tests__/factories/ai-settings.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import {
  createFakeAiActionLog,
  createFakeAiConversation,
  createFakeAiMessage,
  createFakeAiPendingAction,
} from '@/src/__tests__/factories/steel-ai.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { aiConversationNotFound } from '@/src/errors/app-error'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/ai-conversation.repository')
vi.mock('@/src/repositories/ai-pending-action.repository')
vi.mock('@/src/repositories/ai-action-log.repository')
vi.mock('@/src/repositories/ai-settings.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { AiActionLogRepository } from '@/src/repositories/ai-action-log.repository'
import {
  AiConversationRepository,
  AiMessageRepository,
} from '@/src/repositories/ai-conversation.repository'
import { AiPendingActionRepository } from '@/src/repositories/ai-pending-action.repository'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { AiActionLogService } from '../ai-action-log.service'
import { AiConversationService } from '../ai-conversation.service'

const memberships = vi.mocked(MembershipRepository)
const conversations = vi.mocked(AiConversationRepository)
const messages = vi.mocked(AiMessageRepository)
const actions = vi.mocked(AiPendingActionRepository)
const logs = vi.mocked(AiActionLogRepository)
const settings = vi.mocked(WorkspaceAiSettingsRepository)
const audit = vi.mocked(auditMutation)

const conversation = createFakeAiConversation({
  id: 'conv1',
  workspaceId: 'ws1',
  userId: 'u1',
})

function asMember(role: 'OWNER' | 'MEMBER' | null = 'MEMBER') {
  memberships.findByUserAndWorkspace.mockResolvedValue(
    ok(role ? createFakeMembership({ role }) : null),
  )
  conversations.findById.mockResolvedValue(ok(conversation))
  settings.findByWorkspace.mockResolvedValue(ok(null))
}

describe('AiConversationService', () => {
  it('list() should return the caller conversations', async () => {
    asMember()
    conversations.listByUser.mockResolvedValue(ok([conversation]))
    const list = expectOk(await AiConversationService.list('u1', 'ws1', 'cha'))
    expect(list.map((c) => c.id)).toEqual(['conv1'])
    expect(conversations.listByUser).toHaveBeenCalledWith('ws1', 'u1', 'cha')
  })

  it('list() should reject non-members and propagate failures', async () => {
    asMember(null)
    expectErr(await AiConversationService.list('u1', 'ws1'), 'FORBIDDEN')

    asMember()
    conversations.listByUser.mockResolvedValue(err(databaseError()))
    expectErr(await AiConversationService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('create() should create an explore conversation and audit it', async () => {
    asMember()
    conversations.create.mockResolvedValue(ok(conversation))
    const dto = expectOk(
      await AiConversationService.create('u1', 'ws1', {
        title: '',
        mode: 'EXPLORE',
      }),
    )
    expect(dto.id).toBe('conv1')
    expect(conversations.create).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userId: 'u1',
      title: null,
      mode: 'EXPLORE',
      modelKey: null,
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'ai_conversation', action: 'create' }),
    )
  })

  it('create() should allow AGENT only while the workspace switch is on', async () => {
    asMember()
    conversations.create.mockResolvedValue(ok(conversation))
    settings.findByWorkspace.mockResolvedValue(
      ok(createFakeWorkspaceAiSettings({ agentModeEnabled: true })),
    )
    expectOk(await AiConversationService.create('u1', 'ws1', { mode: 'AGENT' }))

    settings.findByWorkspace.mockResolvedValue(
      ok(createFakeWorkspaceAiSettings({ agentModeEnabled: false })),
    )
    expectErr(
      await AiConversationService.create('u1', 'ws1', { mode: 'AGENT' }),
      'AI_AGENT_MODE_DISABLED',
    )

    settings.findByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiConversationService.create('u1', 'ws1', { mode: 'AGENT' }),
      'DATABASE_ERROR',
    )
  })

  it('create() should reject non-members and propagate failures', async () => {
    asMember(null)
    expectErr(
      await AiConversationService.create('u1', 'ws1', { mode: 'EXPLORE' }),
      'FORBIDDEN',
    )
    asMember()
    conversations.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiConversationService.create('u1', 'ws1', { mode: 'EXPLORE' }),
      'DATABASE_ERROR',
    )
  })

  it('get() should return the own conversation or 404', async () => {
    asMember()
    expect(
      expectOk(await AiConversationService.get('u1', 'ws1', 'conv1')).id,
    ).toBe('conv1')
    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await AiConversationService.get('u1', 'ws1', 'conv1'),
      'AI_CONVERSATION_NOT_FOUND',
    )
    asMember(null)
    expectErr(
      await AiConversationService.get('u1', 'ws1', 'conv1'),
      'FORBIDDEN',
    )
  })

  it('update() should rename, switch mode and pin', async () => {
    asMember()
    conversations.update.mockImplementation(async (id, data) =>
      ok({ ...conversation, id, ...data } as typeof conversation),
    )
    const dto = expectOk(
      await AiConversationService.update('u1', 'ws1', 'conv1', {
        title: 'Novo',
        mode: 'AGENT',
        pinned: true,
      }),
    )
    expect(dto.title).toBe('Novo')
    expect(dto.mode).toBe('AGENT')
    expect(dto.pinnedAt).not.toBeNull()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        meta: { workspaceId: 'ws1', fields: ['title', 'mode', 'pinned'] },
      }),
    )
  })

  it('update() should keep an existing pin date and unpin', async () => {
    const pinnedAt = new Date('2026-10-01T00:00:00.000Z')
    asMember()
    conversations.findById.mockResolvedValue(ok({ ...conversation, pinnedAt }))
    conversations.update.mockImplementation(async (id, data) =>
      ok({ ...conversation, id, ...data } as typeof conversation),
    )
    await AiConversationService.update('u1', 'ws1', 'conv1', { pinned: true })
    expect(conversations.update).toHaveBeenLastCalledWith('conv1', { pinnedAt })
    await AiConversationService.update('u1', 'ws1', 'conv1', { pinned: false })
    expect(conversations.update).toHaveBeenLastCalledWith('conv1', {
      pinnedAt: null,
    })
  })

  it('update() should refuse AGENT when off and propagate failures', async () => {
    asMember()
    settings.findByWorkspace.mockResolvedValue(
      ok(createFakeWorkspaceAiSettings({ agentModeEnabled: false })),
    )
    expectErr(
      await AiConversationService.update('u1', 'ws1', 'conv1', {
        mode: 'AGENT',
      }),
      'AI_AGENT_MODE_DISABLED',
    )

    asMember()
    conversations.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiConversationService.update('u1', 'ws1', 'conv1', { title: 'x' }),
      'DATABASE_ERROR',
    )

    asMember()
    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await AiConversationService.update('u1', 'ws1', 'conv1', { title: 'x' }),
      'AI_CONVERSATION_NOT_FOUND',
    )

    asMember(null)
    expectErr(
      await AiConversationService.update('u1', 'ws1', 'conv1', { title: 'x' }),
      'FORBIDDEN',
    )
  })

  it('remove() should soft delete and audit', async () => {
    asMember()
    conversations.softDelete.mockResolvedValue(ok(undefined))
    expect(
      expectOk(await AiConversationService.remove('u1', 'ws1', 'conv1')).id,
    ).toBe('conv1')
    expect(conversations.softDelete).toHaveBeenCalledWith('conv1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', targetId: 'conv1' }),
    )
  })

  it('remove() should propagate failures', async () => {
    asMember(null)
    expectErr(await AiConversationService.remove('u1', 'ws1', 'c'), 'FORBIDDEN')
    asMember()
    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await AiConversationService.remove('u1', 'ws1', 'c'),
      'AI_CONVERSATION_NOT_FOUND',
    )
    asMember()
    conversations.softDelete.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiConversationService.remove('u1', 'ws1', 'c'),
      'DATABASE_ERROR',
    )
  })

  it('listMessages() should fold the transcript', async () => {
    asMember()
    actions.expireOverdue.mockResolvedValue(ok(0))
    messages.listByConversation.mockResolvedValue(
      ok([
        createFakeAiMessage({ id: 'm1', role: 'USER', content: 'Oi' }),
        createFakeAiMessage({
          id: 'm2',
          role: 'ASSISTANT',
          content: 'Olá',
          toolCalls: [{ id: 'c1', name: 'ws_overview', arguments: {} }],
        }),
      ]),
    )
    actions.listByConversation.mockResolvedValue(
      ok([createFakeAiPendingAction({ toolCallId: 'none' })]),
    )
    const list = expectOk(
      await AiConversationService.listMessages('u1', 'ws1', 'conv1'),
    )
    expect(list.map((m) => [m.id, m.role])).toEqual([
      ['m1', 'USER'],
      ['m2', 'ASSISTANT'],
    ])
    expect(actions.expireOverdue).toHaveBeenCalledWith('ws1')
    expect(list[1].toolCalls[0].label).toBe('Consultando o workspace')
  })

  it('listMessages() should propagate failures', async () => {
    asMember(null)
    expectErr(
      await AiConversationService.listMessages('u1', 'ws1', 'c'),
      'FORBIDDEN',
    )

    asMember()
    conversations.findById.mockResolvedValue(err(aiConversationNotFound()))
    expectErr(
      await AiConversationService.listMessages('u1', 'ws1', 'c'),
      'AI_CONVERSATION_NOT_FOUND',
    )

    asMember()
    actions.expireOverdue.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiConversationService.listMessages('u1', 'ws1', 'c'),
      'DATABASE_ERROR',
    )

    asMember()
    actions.expireOverdue.mockResolvedValue(ok(0))
    messages.listByConversation.mockResolvedValue(err(databaseError()))
    actions.listByConversation.mockResolvedValue(ok([]))
    expectErr(
      await AiConversationService.listMessages('u1', 'ws1', 'c'),
      'DATABASE_ERROR',
    )

    messages.listByConversation.mockResolvedValue(ok([]))
    actions.listByConversation.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiConversationService.listMessages('u1', 'ws1', 'c'),
      'DATABASE_ERROR',
    )
  })
})

describe('AiActionLogService.list()', () => {
  it('should let admins read the AI write trail with a clamped limit', async () => {
    memberships.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'OWNER' })),
    )
    logs.listByWorkspace.mockResolvedValue(ok([createFakeAiActionLog()]))

    const list = expectOk(
      await AiActionLogService.list('u1', 'ws1', {
        targetType: 'crm_task',
        targetId: 't1',
        limit: 999,
      }),
    )
    expect(list).toHaveLength(1)
    expect(logs.listByWorkspace).toHaveBeenCalledWith('ws1', {
      targetType: 'crm_task',
      targetId: 't1',
      limit: 200,
    })

    await AiActionLogService.list('u1', 'ws1')
    expect(logs.listByWorkspace).toHaveBeenLastCalledWith('ws1', {
      targetType: undefined,
      targetId: undefined,
      limit: 50,
    })
  })

  it('should refuse members without audit-log access and propagate failures', async () => {
    memberships.findByUserAndWorkspace.mockResolvedValue(
      ok(
        createFakeMembership({
          role: 'MEMBER',
          profile: createFakeProfile({
            isSystem: false,
            systemKey: null,
            permissions: { tasks: ['VIEW'] },
          }),
        }),
      ),
    )
    expectErr(await AiActionLogService.list('u1', 'ws1'), 'FORBIDDEN')

    memberships.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'ADMIN' })),
    )
    logs.listByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(await AiActionLogService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})
