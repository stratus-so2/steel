import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, forbidden, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/whatsapp-conversation.service')
vi.mock('@/src/services/whatsapp-message.service')
vi.mock('@/src/repositories/workspace.repository')

import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { WhatsAppConversationService } from '@/src/services/whatsapp-conversation.service'
import { WhatsAppMessageService } from '@/src/services/whatsapp-message.service'
import {
  zapConversationAssignTool,
  zapConversationCloseTool,
  zapConversationGetTool,
  zapConversationReopenTool,
  zapConversationSetAiTool,
  zapConversationSummaryContextTool,
  zapConversationsListTool,
  zapConversationUnassignTool,
} from '../ai/tools/whatsapp/conversations'
import {
  conversation,
  ctx,
  members,
  message,
  previewOf,
  workspace,
} from './zap-ai-fixtures'

const conversations = vi.mocked(WhatsAppConversationService)
const messages = vi.mocked(WhatsAppMessageService)
const workspaces = vi.mocked(WorkspaceRepository)

beforeEach(() => {
  vi.resetAllMocks()
  workspaces.findById.mockResolvedValue(ok(workspace))
  conversations.listAssignableMembers.mockResolvedValue(ok(members))
})

describe('zap_conversations_list', () => {
  const parse = (args: Record<string, unknown>) =>
    expectOk(zapConversationsListTool.parse(args))

  it('should default to open, non-archived, 20 items and cap the limit at 50', () => {
    expect(parse({})).toMatchObject({
      status: 'OPEN',
      archived: false,
      limit: 20,
      offset: 0,
    })
    expectErr(zapConversationsListTool.parse({ limit: 51 }), 'VALIDATION_ERROR')
    expectErr(
      zapConversationsListTool.parse({ status: 'X' }),
      'VALIDATION_ERROR',
    )
  })

  it('should apply every filter and paginate with names and deep links', async () => {
    const items = [
      conversation({
        id: 'a',
        assignedUserId: 'u1',
        unreadCount: 2,
        avgSentimentScore: -0.5,
        lastMessageAt: '2026-10-05T10:00:00.000Z',
      }),
      conversation({ id: 'b', assignedUserId: 'u2' }),
      conversation({ id: 'c', unreadCount: 0 }),
      conversation({ id: 'd', assignedUserId: 'u1', unreadCount: 0 }),
      conversation({
        id: 'e',
        assignedUserId: 'u1',
        unreadCount: 1,
        avgSentimentScore: null,
      }),
      conversation({
        id: 'f',
        assignedUserId: 'u1',
        unreadCount: 1,
        avgSentimentScore: -0.1,
      }),
      conversation({
        id: 'g',
        assignedUserId: 'u1',
        unreadCount: 1,
        avgSentimentScore: -0.9,
        lastMessageAt: null,
      }),
      conversation({
        id: 'h',
        assignedUserId: 'u1',
        unreadCount: 1,
        avgSentimentScore: -0.9,
        lastMessageAt: '2026-09-01T00:00:00.000Z',
      }),
      conversation({
        id: 'i',
        assignedUserId: 'u1',
        unreadCount: 1,
        avgSentimentScore: -0.9,
        lastMessageAt: '2026-10-07T00:00:00.000Z',
      }),
    ]
    conversations.list.mockResolvedValue(ok(items))

    const out = expectOk(
      await zapConversationsListTool.execute(
        ctx,
        parse({
          status: 'ALL',
          assignedTo: 'me',
          unreadOnly: true,
          negativeSentiment: true,
          lastMessageAfter: '2026-10-01',
          lastMessageBefore: '2026-10-06T00:00:00Z',
          query: 'mar',
          connectionId: 'cn1',
        }),
      ),
    )
    expect(conversations.list).toHaveBeenCalledWith('u1', 'ws1', {
      status: undefined,
      archived: false,
      connectionId: 'cn1',
    })
    const data = out.data as { total: number; items: Record<string, unknown>[] }
    expect(data.total).toBe(1)
    expect(data.items[0]).toMatchObject({
      id: 'a',
      assignedTo: 'Ana',
      contact: 'Maria (+5511999990000)',
      href: '/acme/zap?conversa=a',
    })
    expect(out.summary).toBe('1 conversa(s) encontrada(s)')
  })

  it('should filter unassigned, a specific user and search by number or preview', async () => {
    conversations.list.mockResolvedValue(
      ok([
        conversation({ id: 'a', assignedUserId: 'u2', contactName: null }),
        conversation({ id: 'b', lastMessagePreview: 'boleto atrasado' }),
        conversation({ id: 'c', assignedUserId: 'zz' }),
      ]),
    )
    const unassigned = expectOk(
      await zapConversationsListTool.execute(
        ctx,
        parse({ assignedTo: 'unassigned', query: 'boleto' }),
      ),
    )
    expect((unassigned.data as { total: number }).total).toBe(1)

    const byUser = expectOk(
      await zapConversationsListTool.execute(
        ctx,
        parse({ assignedTo: 'u2', query: '55119' }),
      ),
    )
    const data = byUser.data as { items: Record<string, unknown>[] }
    expect(data.items[0]).toMatchObject({
      id: 'a',
      contact: '+5511999990000',
      assignedTo: 'Bruno',
    })

    const unknownAssignee = expectOk(
      await zapConversationsListTool.execute(ctx, parse({ assignedTo: 'zz' })),
    )
    expect(
      (unknownAssignee.data as { items: Record<string, unknown>[] }).items[0]
        .assignedTo,
    ).toBeNull()
  })

  it('should paginate with offset and report hasMore', async () => {
    conversations.list.mockResolvedValue(
      ok(Array.from({ length: 5 }, (_, i) => conversation({ id: `c${i}` }))),
    )
    const out = expectOk(
      await zapConversationsListTool.execute(
        ctx,
        parse({ limit: 2, offset: 2 }),
      ),
    )
    expect(out.data).toMatchObject({
      total: 5,
      offset: 2,
      limit: 2,
      hasMore: true,
    })
    expect(
      (out.data as { items: { id: string }[] }).items.map((i) => i.id),
    ).toEqual(['c2', 'c3'])
  })

  it('should propagate service, member and workspace errors', async () => {
    conversations.list.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await zapConversationsListTool.execute(ctx, parse({})),
      'FORBIDDEN',
    )

    conversations.list.mockResolvedValue(ok([]))
    conversations.listAssignableMembers.mockResolvedValueOnce(
      err(databaseError('x')),
    )
    expectErr(
      await zapConversationsListTool.execute(ctx, parse({})),
      'DATABASE_ERROR',
    )

    workspaces.findById.mockResolvedValueOnce(err(notFound('Workspace')))
    expectErr(
      await zapConversationsListTool.execute(ctx, parse({})),
      'RESOURCE_NOT_FOUND',
    )
  })
})

describe('zap_conversation_get', () => {
  it('should require the id and cap messages at 50', () => {
    expectErr(zapConversationGetTool.parse({}), 'VALIDATION_ERROR')
    expectErr(
      zapConversationGetTool.parse({ conversationId: 'c1', messages: 60 }),
      'VALIDATION_ERROR',
    )
  })

  it('should return the conversation with compact text-only messages', async () => {
    conversations.get.mockResolvedValue(
      ok(conversation({ assignedUserId: 'u1', closeReason: null })),
    )
    messages.list.mockResolvedValue(
      ok([
        message({ id: 'm1', text: 'x'.repeat(1200) }),
        message({
          id: 'm2',
          direction: 'OUT',
          type: 'IMAGE',
          text: 'foto do produto',
          mediaUrl: 'https://cdn/x.png',
          status: 'READ',
        }),
        message({ id: 'm3', direction: 'OUT', sentByAi: true, text: null }),
      ]),
    )
    const args = expectOk(
      zapConversationGetTool.parse({ conversationId: 'c1', messages: 3 }),
    )
    const out = expectOk(await zapConversationGetTool.execute(ctx, args))
    expect(messages.list).toHaveBeenCalledWith('u1', 'ws1', 'c1', { limit: 3 })
    const data = out.data as {
      conversation: Record<string, unknown>
      messages: Record<string, unknown>[]
    }
    expect(data.conversation).toMatchObject({ id: 'c1', assignedTo: 'Ana' })
    expect((data.messages[0].text as string).length).toBe(1001)
    expect(data.messages[1]).toEqual({
      id: 'm2',
      at: '2026-10-06T12:00:00.000Z',
      author: 'atendente',
      type: 'IMAGE',
      caption: 'foto do produto',
      status: 'READ',
    })
    expect(data.messages[1]).not.toHaveProperty('mediaUrl')
    expect(data.messages[2]).toMatchObject({ author: 'ia', text: null })
    expect(out.target).toEqual({
      type: 'whatsapp_conversation',
      id: 'c1',
      label: 'Maria (+5511999990000)',
      href: '/acme/zap?conversa=c1',
    })
  })

  it('should propagate errors from each dependency', async () => {
    const args = { conversationId: 'c1', messages: 20 }
    conversations.get.mockResolvedValueOnce(err(notFound('Conversa')))
    expectErr(
      await zapConversationGetTool.execute(ctx, args),
      'RESOURCE_NOT_FOUND',
    )

    conversations.get.mockResolvedValue(ok(conversation()))
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await zapConversationGetTool.execute(ctx, args), 'DATABASE_ERROR')

    messages.list.mockResolvedValueOnce(err(forbidden()))
    expectErr(await zapConversationGetTool.execute(ctx, args), 'FORBIDDEN')

    messages.list.mockResolvedValue(ok([]))
    conversations.listAssignableMembers.mockResolvedValueOnce(err(forbidden()))
    expectErr(await zapConversationGetTool.execute(ctx, args), 'FORBIDDEN')
  })
})

describe('zap_conversation_summary_context', () => {
  it('should default to 30 messages and return a transcript', async () => {
    const args = expectOk(
      zapConversationSummaryContextTool.parse({ conversationId: 'c1' }),
    )
    expect(args.messages).toBe(30)
    conversations.get.mockResolvedValue(ok(conversation({ status: 'CLOSED' })))
    messages.list.mockResolvedValue(
      ok([
        message({ text: 'Meu pedido atrasou' }),
        message({ direction: 'OUT', text: 'Vou verificar' }),
        message({ direction: 'OUT', sentByAi: true, text: null }),
        message({ type: 'AUDIO', text: null }),
        message({ type: 'DOCUMENT', text: 'nota.pdf' }),
      ]),
    )
    const out = expectOk(
      await zapConversationSummaryContextTool.execute(ctx, args),
    )
    expect(out.data).toEqual({
      contact: 'Maria (+5511999990000)',
      status: 'Encerrada',
      messageCount: 5,
      transcript: [
        '[2026-10-06T12:00:00.000Z] Cliente: Meu pedido atrasou',
        '[2026-10-06T12:00:00.000Z] Atendente: Vou verificar',
        '[2026-10-06T12:00:00.000Z] IA: ',
        '[2026-10-06T12:00:00.000Z] Cliente: [audio]',
        '[2026-10-06T12:00:00.000Z] Cliente: [document] nota.pdf',
      ],
    })
    expect(out.summary).toBe('5 mensagem(ns) para resumir')
  })

  it('should propagate conversation and message errors', async () => {
    const args = { conversationId: 'c1', messages: 30 }
    conversations.get.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await zapConversationSummaryContextTool.execute(ctx, args),
      'FORBIDDEN',
    )
    conversations.get.mockResolvedValue(ok(conversation()))
    messages.list.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await zapConversationSummaryContextTool.execute(ctx, args),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_conversation_assign', () => {
  const tool = zapConversationAssignTool

  it('should require conversation and user', () => {
    expectErr(tool.parse({ conversationId: 'c1' }), 'VALIDATION_ERROR')
  })

  it('should preview an assignment and a transfer without mutating', async () => {
    conversations.get.mockResolvedValueOnce(ok(conversation()))
    const assign = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1', userId: 'me' }),
    )
    expect(assign.title).toBe('Atribuir a conversa com Maria (+5511999990000)')
    expect(assign.fields).toEqual([
      { label: 'Responsável', before: null, after: 'Ana' },
    ])

    conversations.get.mockResolvedValueOnce(
      ok(conversation({ assignedUserId: 'u1' })),
    )
    const transfer = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1', userId: 'u2' }),
    )
    expect(transfer.title).toMatch(/^Transferir/)
    expect(transfer.fields?.[0]).toMatchObject({
      before: 'Ana',
      after: 'Bruno',
    })

    conversations.get.mockResolvedValueOnce(
      ok(conversation({ assignedUserId: 'gone' })),
    )
    const removed = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1', userId: 'u2' }),
    )
    expect(removed.fields?.[0].before).toBe('Membro removido')
    expect(conversations.assign).not.toHaveBeenCalled()
  })

  it('should refuse non-members, no-op assignments and propagate errors', async () => {
    conversations.get.mockResolvedValue(
      ok(conversation({ assignedUserId: 'u2' })),
    )
    expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1', userId: 'zz' }),
      'VALIDATION_ERROR',
    )
    const same = expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1', userId: 'u2' }),
      'VALIDATION_ERROR',
    )
    expect(same.message).toBe('A conversa já está com Bruno')

    conversations.listAssignableMembers.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1', userId: 'u1' }),
      'FORBIDDEN',
    )
    conversations.get.mockResolvedValueOnce(err(notFound('Conversa')))
    expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1', userId: 'u1' }),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should execute through the service resolving "me"', async () => {
    conversations.assign.mockResolvedValue(
      ok(conversation({ assignedUserId: 'u1' })),
    )
    const out = expectOk(
      await tool.execute(ctx, { conversationId: 'c1', userId: 'me' }),
    )
    expect(conversations.assign).toHaveBeenCalledWith('u1', 'ws1', 'c1', 'u1')
    expect(out.data).toEqual({ id: 'c1', assignedUserId: 'u1' })
    expect(out.target?.href).toBe('/acme/zap?conversa=c1')

    await tool.execute(ctx, { conversationId: 'c1', userId: 'u2' })
    expect(conversations.assign).toHaveBeenLastCalledWith(
      'u1',
      'ws1',
      'c1',
      'u2',
    )

    conversations.assign.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await tool.execute(ctx, { conversationId: 'c1', userId: 'u2' }),
      'FORBIDDEN',
    )
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await tool.execute(ctx, { conversationId: 'c1', userId: 'u2' }),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_conversation_unassign', () => {
  const tool = zapConversationUnassignTool

  it('should preview removing the responsible', async () => {
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ assignedUserId: 'u2' })),
    )
    const preview = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1' }),
    )
    expect(preview.fields).toEqual([
      { label: 'Responsável', before: 'Bruno', after: null },
    ])
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ assignedUserId: 'gone' })),
    )
    const gone = expectOk(await previewOf(tool)(ctx, { conversationId: 'c1' }))
    expect(gone.fields?.[0].before).toBe('Membro removido')
  })

  it('should refuse when unassigned and propagate errors', async () => {
    conversations.get.mockResolvedValueOnce(ok(conversation()))
    expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1' }),
      'VALIDATION_ERROR',
    )
    conversations.get.mockResolvedValueOnce(err(forbidden()))
    expectErr(await previewOf(tool)(ctx, { conversationId: 'c1' }), 'FORBIDDEN')
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ assignedUserId: 'u2' })),
    )
    conversations.listAssignableMembers.mockResolvedValueOnce(err(forbidden()))
    expectErr(await previewOf(tool)(ctx, { conversationId: 'c1' }), 'FORBIDDEN')
    expectErr(tool.parse({}), 'VALIDATION_ERROR')
  })

  it('should execute with a null assignee', async () => {
    conversations.assign.mockResolvedValue(ok(conversation()))
    const out = expectOk(await tool.execute(ctx, { conversationId: 'c1' }))
    expect(conversations.assign).toHaveBeenCalledWith('u1', 'ws1', 'c1', null)
    expect(out.data).toEqual({ id: 'c1', assignedUserId: null })

    conversations.assign.mockResolvedValueOnce(err(forbidden()))
    expectErr(await tool.execute(ctx, { conversationId: 'c1' }), 'FORBIDDEN')
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await tool.execute(ctx, { conversationId: 'c1' }),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_conversation_close', () => {
  const tool = zapConversationCloseTool

  it('should validate the reason length', () => {
    expectErr(
      tool.parse({ conversationId: 'c1', reason: 'x'.repeat(501) }),
      'VALIDATION_ERROR',
    )
  })

  it('should preview status change and reason', async () => {
    conversations.get.mockResolvedValue(ok(conversation({ status: 'NEW' })))
    const preview = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1', reason: 'Resolvido' }),
    )
    expect(preview.fields).toEqual([
      { label: 'Status', before: 'Nova', after: 'Encerrada' },
      { label: 'Motivo', before: null, after: 'Resolvido' },
    ])
    const noReason = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1' }),
    )
    expect(noReason.fields).toHaveLength(1)
  })

  it('should refuse closed conversations and propagate errors', async () => {
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ status: 'CLOSED' })),
    )
    expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1' }),
      'WHATSAPP_CONVERSATION_ALREADY_CLOSED',
    )
    conversations.get.mockResolvedValueOnce(err(forbidden()))
    expectErr(await previewOf(tool)(ctx, { conversationId: 'c1' }), 'FORBIDDEN')
  })

  it('should execute through the service', async () => {
    conversations.close.mockResolvedValue(
      ok(conversation({ status: 'CLOSED' })),
    )
    const out = expectOk(
      await tool.execute(ctx, { conversationId: 'c1', reason: 'ok' }),
    )
    expect(conversations.close).toHaveBeenCalledWith('u1', 'ws1', 'c1', {
      reason: 'ok',
    })
    expect(out.data).toEqual({ id: 'c1', status: 'CLOSED' })

    conversations.close.mockResolvedValueOnce(err(forbidden()))
    expectErr(await tool.execute(ctx, { conversationId: 'c1' }), 'FORBIDDEN')
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await tool.execute(ctx, { conversationId: 'c1' }),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_conversation_reopen', () => {
  const tool = zapConversationReopenTool

  it('should preview the status the conversation returns to', async () => {
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ status: 'CLOSED', assignedUserId: 'u1' })),
    )
    const assigned = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1' }),
    )
    expect(assigned.fields?.[0]).toEqual({
      label: 'Status',
      before: 'Encerrada',
      after: 'Em atendimento',
    })
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ status: 'CLOSED' })),
    )
    const unassigned = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1' }),
    )
    expect(unassigned.fields?.[0].after).toBe('Nova')
  })

  it('should refuse open conversations and propagate errors', async () => {
    conversations.get.mockResolvedValueOnce(ok(conversation()))
    expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1' }),
      'WHATSAPP_CONVERSATION_NOT_CLOSED',
    )
    conversations.get.mockResolvedValueOnce(err(forbidden()))
    expectErr(await previewOf(tool)(ctx, { conversationId: 'c1' }), 'FORBIDDEN')
  })

  it('should execute through the service', async () => {
    conversations.reopen.mockResolvedValue(ok(conversation({ status: 'NEW' })))
    const out = expectOk(await tool.execute(ctx, { conversationId: 'c1' }))
    expect(out.data).toEqual({ id: 'c1', status: 'NEW' })
    conversations.reopen.mockResolvedValueOnce(err(forbidden()))
    expectErr(await tool.execute(ctx, { conversationId: 'c1' }), 'FORBIDDEN')
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await tool.execute(ctx, { conversationId: 'c1' }),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_conversation_set_ai', () => {
  const tool = zapConversationSetAiTool

  it('should require the boolean flag', () => {
    expectErr(tool.parse({ conversationId: 'c1' }), 'VALIDATION_ERROR')
  })

  it('should preview turning the AI on and off', async () => {
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ aiActive: false })),
    )
    const on = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1', enabled: true }),
    )
    expect(on.fields).toEqual([
      {
        label: 'Resposta automática da IA',
        before: 'Desligada',
        after: 'Ligada',
      },
    ])
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ aiActive: true })),
    )
    const off = expectOk(
      await previewOf(tool)(ctx, { conversationId: 'c1', enabled: false }),
    )
    expect(off.title).toMatch(/^Desligar a IA/)
    expect(off.summary).toMatch(/atendimento humano/)
  })

  it('should refuse a no-op and propagate errors', async () => {
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ aiActive: true })),
    )
    const noop = expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1', enabled: true }),
      'VALIDATION_ERROR',
    )
    expect(noop.message).toMatch(/já está ligada/)
    conversations.get.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await previewOf(tool)(ctx, { conversationId: 'c1', enabled: true }),
      'FORBIDDEN',
    )
  })

  it('should call resumeAi or removeFromAi', async () => {
    conversations.resumeAi.mockResolvedValue(
      ok(conversation({ aiActive: true })),
    )
    conversations.removeFromAi.mockResolvedValue(
      ok(conversation({ aiActive: false })),
    )
    const on = expectOk(
      await tool.execute(ctx, { conversationId: 'c1', enabled: true }),
    )
    expect(on.data).toEqual({ id: 'c1', aiActive: true })
    expect(on.summary).toMatch(/^IA ligada/)
    const off = expectOk(
      await tool.execute(ctx, { conversationId: 'c1', enabled: false }),
    )
    expect(off.data).toEqual({ id: 'c1', aiActive: false })
    expect(conversations.removeFromAi).toHaveBeenCalledWith('u1', 'ws1', 'c1')

    conversations.resumeAi.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await tool.execute(ctx, { conversationId: 'c1', enabled: true }),
      'FORBIDDEN',
    )
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await tool.execute(ctx, { conversationId: 'c1', enabled: true }),
      'DATABASE_ERROR',
    )
  })
})
