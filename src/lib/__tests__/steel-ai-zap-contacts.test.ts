import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeWhatsAppContact } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { conflict, databaseError, forbidden } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/authz')
vi.mock('@/src/services/whatsapp-contact.service')
vi.mock('@/src/services/whatsapp-conversation.service')
vi.mock('@/src/repositories/whatsapp-contact.repository')
vi.mock('@/src/repositories/workspace.repository')

import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { assertModuleMember } from '@/src/services/authz'
import { WhatsAppContactService } from '@/src/services/whatsapp-contact.service'
import { WhatsAppConversationService } from '@/src/services/whatsapp-conversation.service'
import {
  zapContactCreateTool,
  zapContactDeleteTool,
  zapContactGetTool,
  zapContactsSearchTool,
  zapContactUpdateTool,
} from '../ai/tools/whatsapp/contacts'
import {
  contact,
  conversation,
  ctx,
  previewOf,
  workspace,
} from './zap-ai-fixtures'

const service = vi.mocked(WhatsAppContactService)
const repo = vi.mocked(WhatsAppContactRepository)
const conversations = vi.mocked(WhatsAppConversationService)
const authz = vi.mocked(assertModuleMember)
const workspaces = vi.mocked(WorkspaceRepository)

const row = createFakeWhatsAppContact({
  id: 'ct1',
  workspaceId: 'ws1',
  waId: '5511999990000',
  name: 'Maria',
})

beforeEach(() => {
  vi.resetAllMocks()
  workspaces.findById.mockResolvedValue(ok(workspace))
  authz.mockResolvedValue(ok({} as never))
  repo.findById.mockResolvedValue(ok(row))
  service.list.mockResolvedValue(ok([contact({ conversationCount: 3 })]))
})

describe('zap_contacts_search', () => {
  it('should cap the limit and search through the service', async () => {
    expectErr(zapContactsSearchTool.parse({ limit: 100 }), 'VALIDATION_ERROR')
    service.list.mockResolvedValue(
      ok([
        contact({ id: 'a', description: 'd'.repeat(400) }),
        contact({ id: 'b', broadcastOptedOutAt: '2026-10-01T00:00:00.000Z' }),
      ]),
    )
    const out = expectOk(
      await zapContactsSearchTool.execute(
        ctx,
        expectOk(zapContactsSearchTool.parse({ query: 'mar' })),
      ),
    )
    expect(service.list).toHaveBeenCalledWith('u1', 'ws1', { search: 'mar' })
    const data = out.data as {
      total: number
      href: string
      items: Record<string, unknown>[]
    }
    expect(data.total).toBe(2)
    expect(data.href).toBe('/acme/zap/contatos')
    expect((data.items[0].description as string).length).toBe(301)
    expect(data.items[1]).toMatchObject({ id: 'b', optedOut: true })
  })

  it('should filter by opt-out status both ways', async () => {
    service.list.mockResolvedValue(
      ok([
        contact({ id: 'a' }),
        contact({ id: 'b', broadcastOptedOutAt: '2026-10-01T00:00:00.000Z' }),
      ]),
    )
    const out = expectOk(
      await zapContactsSearchTool.execute(
        ctx,
        expectOk(zapContactsSearchTool.parse({ optedOut: true })),
      ),
    )
    expect((out.data as { items: { id: string }[] }).items).toEqual([
      expect.objectContaining({ id: 'b' }),
    ])
    const active = expectOk(
      await zapContactsSearchTool.execute(
        ctx,
        expectOk(zapContactsSearchTool.parse({ optedOut: false })),
      ),
    )
    expect(active.summary).toBe('1 contato(s) encontrado(s)')
  })

  it('should propagate errors', async () => {
    const args = expectOk(zapContactsSearchTool.parse({}))
    service.list.mockResolvedValueOnce(err(forbidden()))
    expectErr(await zapContactsSearchTool.execute(ctx, args), 'FORBIDDEN')
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await zapContactsSearchTool.execute(ctx, args), 'DATABASE_ERROR')
  })
})

describe('zap_contact_get', () => {
  it('should authorize contacts:VIEW and list the contact conversations', async () => {
    conversations.list.mockResolvedValue(
      ok([
        conversation({ id: 'c1', contactId: 'ct1' }),
        conversation({ id: 'c2', contactId: 'other' }),
      ]),
    )
    const out = expectOk(
      await zapContactGetTool.execute(ctx, { contactId: 'ct1' }),
    )
    expect(authz).toHaveBeenCalledWith('u1', 'ws1', 'COMMUNICATION', {
      resource: 'contacts',
      action: 'VIEW',
    })
    expect(service.list).toHaveBeenCalledWith('u1', 'ws1', {
      search: '5511999990000',
    })
    expect(out.data).toMatchObject({
      contact: { id: 'ct1', conversationCount: 3 },
      conversations: [
        { id: 'c1', status: 'Em atendimento', href: '/acme/zap?conversa=c1' },
      ],
    })
    expect(out.target).toEqual({
      type: 'whatsapp_contact',
      id: 'ct1',
      label: 'Maria (+5511999990000)',
      href: '/acme/zap/contatos',
    })
  })

  it('should still show the contact without conversations:VIEW', async () => {
    service.list.mockResolvedValue(ok([]))
    conversations.list.mockResolvedValue(err(forbidden()))
    const out = expectOk(
      await zapContactGetTool.execute(ctx, { contactId: 'ct1' }),
    )
    expect(out.data).toMatchObject({
      contact: { id: 'ct1', conversationCount: 0 },
      conversations: null,
    })
  })

  it('should map authz, not-found and database errors', async () => {
    expectErr(zapContactGetTool.parse({}), 'VALIDATION_ERROR')
    authz.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await zapContactGetTool.execute(ctx, { contactId: 'x' }),
      'FORBIDDEN',
    )
    repo.findById.mockResolvedValueOnce(ok(null))
    expectErr(
      await zapContactGetTool.execute(ctx, { contactId: 'x' }),
      'WHATSAPP_CONTACT_NOT_FOUND',
    )
    repo.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await zapContactGetTool.execute(ctx, { contactId: 'x' }),
      'DATABASE_ERROR',
    )
    service.list.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await zapContactGetTool.execute(ctx, { contactId: 'x' }),
      'FORBIDDEN',
    )
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await zapContactGetTool.execute(ctx, { contactId: 'x' }),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_contact_create', () => {
  const tool = zapContactCreateTool

  it('should normalize the number to digits and validate it', () => {
    expect(expectOk(tool.parse({ waId: '+55 (11) 99999-0000' })).waId).toBe(
      '5511999990000',
    )
    expectErr(tool.parse({ waId: '123' }), 'VALIDATION_ERROR')
  })

  it('should preview the new contact and refuse duplicates', async () => {
    service.list.mockResolvedValueOnce(ok([contact({ waId: '551188' })]))
    const preview = expectOk(
      await previewOf(tool)(ctx, { waId: '5511999990000', name: 'Maria' }),
    )
    expect(preview.title).toBe('Criar o contato Maria (+5511999990000)')
    expect(preview.fields).toEqual([
      { label: 'Número', after: '+5511999990000' },
      { label: 'Nome', after: 'Maria' },
      { label: 'Descrição', after: null },
    ])
    expect(preview.target).toEqual({
      type: 'whatsapp_contact',
      label: 'Maria',
      href: '/acme/zap/contatos',
    })

    service.list.mockResolvedValueOnce(ok([]))
    const anonymous = expectOk(
      await previewOf(tool)(ctx, { waId: '5511999990000', description: 'VIP' }),
    )
    expect(anonymous.target?.label).toBe('+5511999990000')

    const dup = expectErr(
      await previewOf(tool)(ctx, { waId: '5511999990000' }),
      'CONFLICT',
    )
    expect(dup.message).toMatch(/Maria/)
  })

  it('should propagate preview errors', async () => {
    service.list.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await previewOf(tool)(ctx, { waId: '5511999990000' }),
      'FORBIDDEN',
    )
    service.list.mockResolvedValueOnce(ok([]))
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await previewOf(tool)(ctx, { waId: '5511999990000' }),
      'DATABASE_ERROR',
    )
  })

  it('should create through the service and map conflicts', async () => {
    service.create.mockResolvedValue(ok(contact({ id: 'new' })))
    const out = expectOk(
      await tool.execute(ctx, { waId: '5511999990000', name: 'Maria' }),
    )
    expect(service.create).toHaveBeenCalledWith('u1', 'ws1', {
      waId: '5511999990000',
      name: 'Maria',
    })
    expect(out.target?.id).toBe('new')
    service.create.mockResolvedValueOnce(
      err(conflict('Este contato já existe')),
    )
    expectErr(await tool.execute(ctx, { waId: '5511999990000' }), 'CONFLICT')
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await tool.execute(ctx, { waId: '5511999990000' }),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_contact_update', () => {
  const tool = zapContactUpdateTool

  it('should require at least one field', () => {
    expectErr(tool.parse({ contactId: 'ct1' }), 'VALIDATION_ERROR')
    expectOk(tool.parse({ contactId: 'ct1', name: null }))
  })

  it('should preview before → after, clearing with null or empty', async () => {
    service.list.mockResolvedValue(
      ok([contact({ conversationCount: 3, description: 'Antiga' })]),
    )
    const preview = expectOk(
      await previewOf(tool)(ctx, {
        contactId: 'ct1',
        name: 'Maria Souza',
        description: '',
      }),
    )
    expect(preview.fields).toEqual([
      { label: 'Nome', before: 'Maria', after: 'Maria Souza' },
      { label: 'Descrição', before: 'Antiga', after: null },
    ])
    const onlyDescription = expectOk(
      await previewOf(tool)(ctx, { contactId: 'ct1', description: 'Nova' }),
    )
    expect(onlyDescription.fields).toHaveLength(1)
  })

  it('should propagate preview errors', async () => {
    repo.findById.mockResolvedValueOnce(ok(null))
    expectErr(
      await previewOf(tool)(ctx, { contactId: 'x', name: 'A' }),
      'WHATSAPP_CONTACT_NOT_FOUND',
    )
  })

  it('should update through the service', async () => {
    service.update.mockResolvedValue(ok(contact({ name: null })))
    const out = expectOk(
      await tool.execute(ctx, { contactId: 'ct1', name: null }),
    )
    expect(service.update).toHaveBeenCalledWith('u1', 'ws1', 'ct1', {
      name: null,
      description: undefined,
    })
    expect(out.summary).toBe('Contato +5511999990000 atualizado')
    service.update.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await tool.execute(ctx, { contactId: 'ct1', name: 'A' }),
      'FORBIDDEN',
    )
    workspaces.findById.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await tool.execute(ctx, { contactId: 'ct1', name: 'A' }),
      'DATABASE_ERROR',
    )
  })
})

describe('zap_contact_delete', () => {
  const tool = zapContactDeleteTool

  it('should be a DELETE that warns about cascading conversations', async () => {
    expect(tool.kind).toBe('DELETE')
    const preview = expectOk(await previewOf(tool)(ctx, { contactId: 'ct1' }))
    expect(preview.summary).toMatch(/3 conversa/)
    expect(preview.fields).toEqual([
      { label: 'Contato', before: 'Maria (+5511999990000)', after: null },
      { label: 'Conversas', before: '3', after: null },
    ])
    service.list.mockResolvedValueOnce(ok([contact({ conversationCount: 0 })]))
    const empty = expectOk(await previewOf(tool)(ctx, { contactId: 'ct1' }))
    expect(empty.summary).toBe('Não pode ser desfeito.')
  })

  it('should propagate preview errors', async () => {
    authz.mockResolvedValueOnce(err(forbidden()))
    expectErr(await previewOf(tool)(ctx, { contactId: 'ct1' }), 'FORBIDDEN')
  })

  it('should delete through the service', async () => {
    service.remove.mockResolvedValue(ok(undefined))
    const out = expectOk(await tool.execute(ctx, { contactId: 'ct1' }))
    expect(service.remove).toHaveBeenCalledWith('u1', 'ws1', 'ct1')
    expect(out.data).toEqual({ id: 'ct1', deleted: true })
    service.remove.mockResolvedValueOnce(err(forbidden()))
    expectErr(await tool.execute(ctx, { contactId: 'ct1' }), 'FORBIDDEN')
    repo.findById.mockResolvedValueOnce(ok(null))
    expectErr(
      await tool.execute(ctx, { contactId: 'ct1' }),
      'WHATSAPP_CONTACT_NOT_FOUND',
    )
  })
})
