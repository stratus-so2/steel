import type { WhatsAppContact } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, forbidden, whatsappProviderError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/whatsapp-conversation.service')
vi.mock('@/src/services/whatsapp-message.service')
vi.mock('@/src/services/whatsapp-connection.service')
vi.mock('@/src/repositories/whatsapp-contact.repository')
vi.mock('@/src/repositories/sd-whatsapp.repository')
vi.mock('@/src/repositories/workspace.repository')

import { SdWhatsappRepository } from '@/src/repositories/sd-whatsapp.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { WhatsAppConnectionService } from '@/src/services/whatsapp-connection.service'
import { WhatsAppConversationService } from '@/src/services/whatsapp-conversation.service'
import { WhatsAppMessageService } from '@/src/services/whatsapp-message.service'
import {
  zapMessageSendTextTool as tool,
  whatsappContactOptedOut,
  whatsappSessionWindowClosed,
} from '../ai/tools/whatsapp/messages'
import {
  connection,
  conversation,
  ctx,
  message,
  previewOf,
  workspace,
} from './zap-ai-fixtures'

const conversations = vi.mocked(WhatsAppConversationService)
const messages = vi.mocked(WhatsAppMessageService)
const connections = vi.mocked(WhatsAppConnectionService)
const contacts = vi.mocked(WhatsAppContactRepository)
const sdWhatsapp = vi.mocked(SdWhatsappRepository)
const workspaces = vi.mocked(WorkspaceRepository)

const NOW = new Date('2026-10-06T12:00:00.000Z')
const args = { conversationId: 'c1', text: 'Seu pedido saiu para entrega.' }

function contactRow(optedOut = false) {
  return {
    id: 'ct1',
    workspaceId: 'ws1',
    waId: '5511999990000',
    name: 'Maria',
    broadcastOptedOutAt: optedOut ? NOW : null,
  } as WhatsAppContact
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] })
  workspaces.findById.mockResolvedValue(ok(workspace))
  conversations.get.mockResolvedValue(ok(conversation()))
  contacts.findById.mockResolvedValue(ok(contactRow()))
  connections.list.mockResolvedValue(ok([connection()]))
  sdWhatsapp.lastInboundAt.mockResolvedValue(ok(null))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('zap_message_send_text', () => {
  it('should be an ACTION gated by conversations:CREATE', () => {
    expect(tool.kind).toBe('ACTION')
    expect(tool.permission).toEqual({
      resource: 'conversations',
      action: 'CREATE',
    })
  })

  it('should reject empty or oversized text', () => {
    expectErr(
      tool.parse({ conversationId: 'c1', text: '   ' }),
      'VALIDATION_ERROR',
    )
    expectErr(
      tool.parse({ conversationId: 'c1', text: 'x'.repeat(4097) }),
      'VALIDATION_ERROR',
    )
    expect(
      expectOk(tool.parse({ conversationId: 'c1', text: ' oi ' })).text,
    ).toBe('oi')
  })

  it('should preview the exact text, recipient and connection with a warning', async () => {
    const preview = expectOk(await previewOf(tool)(ctx, args))
    expect(preview.title).toBe(
      'Enviar mensagem no WhatsApp para Maria (+5511999990000)',
    )
    expect(preview.summary).toMatch(/entregue ao cliente/)
    expect(preview.fields).toEqual([
      { label: 'Destinatário', after: 'Maria (+5511999990000)' },
      { label: 'Conexão', after: 'Comercial (+55 11 4000-0000)' },
      { label: 'Mensagem', after: 'Seu pedido saiu para entrega.' },
    ])
    expect(preview.target?.href).toBe('/acme/zap?conversa=c1')
    expect(messages.sendText).not.toHaveBeenCalled()
    // Z-API has no 24 h window.
    expect(sdWhatsapp.lastInboundAt).not.toHaveBeenCalled()
  })

  it('should allow Meta conversations inside the 24 h window', async () => {
    connections.list.mockResolvedValue(ok([connection({ provider: 'META' })]))
    sdWhatsapp.lastInboundAt.mockResolvedValue(
      ok(new Date('2026-10-06T01:00:00.000Z')),
    )
    expectOk(await previewOf(tool)(ctx, args))
    expect(sdWhatsapp.lastInboundAt).toHaveBeenCalledWith('c1')
  })

  it('should refuse a closed Meta window or no inbound message at all', async () => {
    connections.list.mockResolvedValue(ok([connection({ provider: 'META' })]))
    sdWhatsapp.lastInboundAt.mockResolvedValueOnce(
      ok(new Date('2026-10-05T11:00:00.000Z')),
    )
    const closed = expectErr(
      await previewOf(tool)(ctx, args),
      'WHATSAPP_SESSION_WINDOW_CLOSED',
    )
    expect(closed.message).toBe(whatsappSessionWindowClosed().message)
    expectErr(
      await previewOf(tool)(ctx, args),
      'WHATSAPP_SESSION_WINDOW_CLOSED',
    )

    sdWhatsapp.lastInboundAt.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await previewOf(tool)(ctx, args), 'DATABASE_ERROR')
  })

  it('should refuse opted-out contacts (LGPD)', async () => {
    contacts.findById.mockResolvedValue(ok(contactRow(true)))
    const error = expectErr(
      await previewOf(tool)(ctx, args),
      'WHATSAPP_CONTACT_OPTED_OUT',
    )
    expect(error.message).toBe(whatsappContactOptedOut().message)
    expectErr(await tool.execute(ctx, args), 'WHATSAPP_CONTACT_OPTED_OUT')
    expect(messages.sendText).not.toHaveBeenCalled()
  })

  it('should refuse closed conversations and conversations under AI', async () => {
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ status: 'CLOSED' })),
    )
    const closed = expectErr(
      await previewOf(tool)(ctx, args),
      'WHATSAPP_CONVERSATION_ALREADY_CLOSED',
    )
    expect(closed.message).toMatch(/reabra/)
    conversations.get.mockResolvedValueOnce(
      ok(conversation({ aiActive: true })),
    )
    expectErr(
      await previewOf(tool)(ctx, args),
      'WHATSAPP_CONVERSATION_AI_HANDLING',
    )
  })

  it('should map missing records and dependency errors', async () => {
    conversations.get.mockResolvedValueOnce(err(forbidden()))
    expectErr(await previewOf(tool)(ctx, args), 'FORBIDDEN')

    contacts.findById.mockResolvedValueOnce(ok(null))
    expectErr(await previewOf(tool)(ctx, args), 'WHATSAPP_CONTACT_NOT_FOUND')
    contacts.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await previewOf(tool)(ctx, args), 'DATABASE_ERROR')

    connections.list.mockResolvedValueOnce(ok([connection({ id: 'other' })]))
    expectErr(await previewOf(tool)(ctx, args), 'WHATSAPP_CONNECTION_NOT_FOUND')
    connections.list.mockResolvedValueOnce(err(forbidden()))
    expectErr(await previewOf(tool)(ctx, args), 'FORBIDDEN')

    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await previewOf(tool)(ctx, args), 'DATABASE_ERROR')
  })

  it('should revalidate and send through the message service', async () => {
    messages.sendText.mockResolvedValue(
      ok(message({ id: 'm9', direction: 'OUT', status: 'SENT' })),
    )
    const out = expectOk(await tool.execute(ctx, args))
    expect(conversations.get).toHaveBeenCalledWith('u1', 'ws1', 'c1')
    expect(messages.sendText).toHaveBeenCalledWith('u1', 'ws1', 'c1', {
      text: 'Seu pedido saiu para entrega.',
    })
    expect(out).toEqual({
      data: { messageId: 'm9', conversationId: 'c1', status: 'SENT' },
      summary: 'Mensagem enviada para Maria (+5511999990000)',
      target: {
        type: 'whatsapp_conversation',
        id: 'c1',
        label: 'Maria (+5511999990000)',
        href: '/acme/zap?conversa=c1',
      },
    })
  })

  it('should surface provider errors and a window that closed while pending', async () => {
    messages.sendText.mockResolvedValueOnce(
      err(whatsappProviderError('(#131047) Re-engagement message')),
    )
    expectErr(await tool.execute(ctx, args), 'WHATSAPP_PROVIDER_ERROR')

    connections.list.mockResolvedValue(ok([connection({ provider: 'META' })]))
    expectErr(await tool.execute(ctx, args), 'WHATSAPP_SESSION_WINDOW_CLOSED')
    expect(messages.sendText).toHaveBeenCalledTimes(1)
  })
})
