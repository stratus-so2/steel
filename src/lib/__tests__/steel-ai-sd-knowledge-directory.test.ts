import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  sdConfigDTO,
  sdConfigItemDTO,
  sdContactDTO,
  sdCustomerDTO,
  sdKbArticleDTO,
  sdKbSearchDTO,
  sdPreview,
  sdTicketDTO,
} from '@/src/__tests__/factories/steel-ai-sd.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdNotAgent, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/services/sd-config.service')
vi.mock('@/src/services/sd-ticket.service')
vi.mock('@/src/services/sd-kb-article.service')
vi.mock('@/src/services/sd-kb-draft.service')
vi.mock('@/src/services/sd-customer.service')
vi.mock('@/src/services/sd-contact.service')
vi.mock('@/src/services/sd-config-item.service')

import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { SdConfigService } from '@/src/services/sd-config.service'
import { SdConfigItemService } from '@/src/services/sd-config-item.service'
import { SdContactService } from '@/src/services/sd-contact.service'
import { SdCustomerService } from '@/src/services/sd-customer.service'
import { SdKbArticleService } from '@/src/services/sd-kb-article.service'
import { SdKbDraftService } from '@/src/services/sd-kb-draft.service'
import { SdTicketService } from '@/src/services/sd-ticket.service'
import { SERVICEDESK_AI_TOOLS } from '../ai/tools/servicedesk'
import {
  sdCatalogTool,
  sdGetConfigItemTool,
  sdSearchConfigItemsTool,
  sdSearchContactsTool,
  sdSearchCustomersTool,
} from '../ai/tools/servicedesk/directory'
import {
  sdCreateKbDraftFromTicketTool,
  sdDeleteKbDraftTool,
  sdGetKbArticleTool,
  sdSearchKbTool,
} from '../ai/tools/servicedesk/knowledge'

const ctx = {
  workspaceId: 'ws1',
  actorId: 'user-me',
  source: 'assistant' as const,
}
const kb = vi.mocked(SdKbArticleService)
const ID = 'abcdefghijklmnopqrstuvwx'
const category = {
  id: 'kbc-1',
  name: 'E-mail',
  icon: null,
  description: null,
  parentId: null,
  articleCount: 2,
}

function page<T>(items: T[], total = items.length) {
  return ok({ items, total, page: 1, pageSize: 20 })
}

function slugFails() {
  vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
    err(databaseError('x')),
  )
}

beforeEach(() => {
  vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
    ok({ slug: 'acme' } as never),
  )
  vi.mocked(SdConfigService.bootstrap).mockResolvedValue(ok(sdConfigDTO()))
  vi.mocked(SdTicketService.get).mockResolvedValue(ok(sdTicketDTO()))
  kb.listCategories.mockResolvedValue(ok([category]))
})

describe('SERVICEDESK_AI_TOOLS', () => {
  it('should expose sd_ tools of the ServiceDesk module, writes with preview', () => {
    expect(SERVICEDESK_AI_TOOLS.length).toBe(27)
    for (const tool of SERVICEDESK_AI_TOOLS) {
      expect(tool.name.startsWith('sd_')).toBe(true)
      expect(tool.module).toBe('SERVICE_DESK')
      expect(tool.permission?.resource.startsWith('sd-')).toBe(true)
      if (tool.kind !== 'READ') expect(typeof tool.preview).toBe('function')
    }
    expect(
      SERVICEDESK_AI_TOOLS.filter((t) => t.kind === 'DELETE').map(
        (t) => t.name,
      ),
    ).toEqual(['sd_delete_kb_draft', 'sd_delete_ticket_task'])
  })
})

describe('sd_search_kb', () => {
  it('should search with a resolved category and deep links', async () => {
    kb.search.mockResolvedValue(ok([sdKbSearchDTO()]))
    const out = expectOk(
      await sdSearchKbTool.execute(
        ctx,
        expectOk(
          sdSearchKbTool.parse({
            query: 'servidor',
            category: 'e-mail',
            status: 'PUBLISHED',
            tag: 'Email',
          }),
        ),
      ),
    )
    expect(out.summary).toBe('1 artigo(s) encontrado(s)')
    expect(out.data).toMatchObject({
      items: [{ id: 'kb-1', href: '/acme/servicedesk/knowledge/kb-1' }],
    })
    expect(kb.search).toHaveBeenCalledWith('user-me', 'ws1', {
      q: 'servidor',
      status: 'PUBLISHED',
      visibility: undefined,
      categoryId: 'kbc-1',
      tag: 'email',
      limit: 20,
    })
  })

  it('should surface category, search and slug errors', async () => {
    const args = expectOk(sdSearchKbTool.parse({ category: 'Rede' }))
    expectErr(await sdSearchKbTool.execute(ctx, args), 'VALIDATION_ERROR')
    kb.listCategories.mockResolvedValue(err(databaseError('x')))
    expectErr(await sdSearchKbTool.execute(ctx, args), 'DATABASE_ERROR')
    const plain = expectOk(sdSearchKbTool.parse({}))
    kb.search.mockResolvedValue(err(sdNotAgent()))
    expectErr(await sdSearchKbTool.execute(ctx, plain), 'SD_NOT_AGENT')
    kb.search.mockResolvedValue(ok([]))
    slugFails()
    expectErr(await sdSearchKbTool.execute(ctx, plain), 'DATABASE_ERROR')
  })
})

describe('sd_get_kb_article', () => {
  it('should return the plain text and metadata', async () => {
    kb.getById.mockResolvedValue(
      ok(sdKbArticleDTO({ category: { id: 'c', name: 'E-mail', icon: null } })),
    )
    const out = expectOk(await sdGetKbArticleTool.execute(ctx, { article: ID }))
    expect(out.data).toMatchObject({
      text: 'Passo 1: reinicie.',
      category: 'E-mail',
      href: '/acme/servicedesk/knowledge/kb-1',
    })
    expect(out.summary).toBe(
      'Artigo “Como reiniciar o servidor de e-mail” (Publicado)',
    )
    expect(out.target?.type).toBe('sd_kb_article')
  })

  it('should surface lookup, read and slug errors', async () => {
    kb.search.mockResolvedValue(ok([]))
    expectErr(
      await sdGetKbArticleTool.execute(ctx, { article: 'nada' }),
      'VALIDATION_ERROR',
    )
    kb.search.mockResolvedValue(ok([sdKbSearchDTO()]))
    kb.getById.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await sdGetKbArticleTool.execute(ctx, { article: 'Como' }),
      'DATABASE_ERROR',
    )
    kb.getById.mockResolvedValue(ok(sdKbArticleDTO()))
    slugFails()
    expectErr(
      await sdGetKbArticleTool.execute(ctx, { article: 'Como' }),
      'DATABASE_ERROR',
    )
  })
})

describe('sd_create_kb_draft_from_ticket', () => {
  it('should preview the AI draft with the KB category', async () => {
    const preview = expectOk(
      await sdPreview(
        sdCreateKbDraftFromTicketTool,
        ctx,
        expectOk(
          sdCreateKbDraftFromTicketTool.parse({
            ticket: '42',
            category: 'E-mail',
          }),
        ),
      ),
    )
    expect(preview.summary).toContain('cota de IA')
    expect(preview.fields).toContainEqual({
      label: 'Categoria',
      after: 'E-mail',
    })
    expect(preview.target?.href).toBe('/acme/servicedesk/tickets/42')
  })

  it('should preview the empty skeleton without AI', async () => {
    const preview = expectOk(
      await sdPreview(sdCreateKbDraftFromTicketTool, ctx, {
        ticket: '42',
        useAi: false,
      }),
    )
    expect(preview.summary).toContain('esqueleto KCS')
    expect(preview.fields).toContainEqual({
      label: 'Categoria',
      after: 'A do catálogo do chamado',
    })
  })

  it('should create the draft through the KCS service', async () => {
    vi.mocked(SdKbDraftService.fromTicket).mockResolvedValue(
      ok({
        article: sdKbArticleDTO({ status: 'DRAFT' }),
        aiUsed: true,
        aiSkippedReason: null,
      }),
    )
    const out = expectOk(
      await sdCreateKbDraftFromTicketTool.execute(ctx, {
        ticket: '42',
        useAi: true,
        category: 'E-mail',
      }),
    )
    expect(out.summary).toBe(
      'Rascunho “Como reiniciar o servidor de e-mail” criado pela IA',
    )
    expect(SdKbDraftService.fromTicket).toHaveBeenCalledWith('user-me', 'ws1', {
      ticketId: 'ticket-1',
      useAi: true,
      categoryId: 'kbc-1',
    })
    vi.mocked(SdKbDraftService.fromTicket).mockResolvedValue(
      ok({
        article: sdKbArticleDTO({ status: 'DRAFT' }),
        aiUsed: false,
        aiSkippedReason: 'ai_disabled',
      }),
    )
    const skeleton = expectOk(
      await sdCreateKbDraftFromTicketTool.execute(ctx, {
        ticket: '42',
        useAi: true,
      }),
    )
    expect(skeleton.summary).toContain('esqueleto KCS')
  })

  it('should surface ticket, category, service and slug errors', async () => {
    const args = { ticket: '42', useAi: true }
    expectErr(
      await sdPreview(sdCreateKbDraftFromTicketTool, ctx, {
        ...args,
        category: 'Rede',
      }),
      'VALIDATION_ERROR',
    )
    vi.mocked(SdTicketService.get).mockResolvedValueOnce(
      err(sdTicketNotFound()),
    )
    expectErr(
      await sdCreateKbDraftFromTicketTool.execute(ctx, args),
      'SD_TICKET_NOT_FOUND',
    )
    vi.mocked(SdKbDraftService.fromTicket).mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdCreateKbDraftFromTicketTool.execute(ctx, args),
      'SD_NOT_AGENT',
    )
    vi.mocked(SdKbDraftService.fromTicket).mockResolvedValue(
      ok({ article: sdKbArticleDTO(), aiUsed: true, aiSkippedReason: null }),
    )
    vi.mocked(WorkspaceRepository.findById)
      .mockResolvedValueOnce(ok({ slug: 'acme' } as never))
      .mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await sdCreateKbDraftFromTicketTool.execute(ctx, args),
      'DATABASE_ERROR',
    )
  })
})

describe('sd_delete_kb_draft', () => {
  it('should only discard active drafts', async () => {
    kb.getById.mockResolvedValue(ok(sdKbArticleDTO()))
    expectErr(
      await sdPreview(sdDeleteKbDraftTool, ctx, { article: ID }),
      'VALIDATION_ERROR',
    )
    kb.getById.mockResolvedValue(
      ok(sdKbArticleDTO({ status: 'DRAFT', archivedAt: '2026-10-01' })),
    )
    expectErr(
      await sdDeleteKbDraftTool.execute(ctx, { article: ID }),
      'VALIDATION_ERROR',
    )
  })

  it('should preview and archive a draft', async () => {
    kb.getById.mockResolvedValue(ok(sdKbArticleDTO({ status: 'DRAFT' })))
    const preview = expectOk(
      await sdPreview(sdDeleteKbDraftTool, ctx, { article: ID }),
    )
    expect(preview.fields).toEqual([
      {
        label: 'Artigo',
        before: 'Como reiniciar o servidor de e-mail',
        after: null,
      },
      { label: 'Situação', before: 'Rascunho', after: 'Na lixeira' },
    ])
    kb.archive.mockResolvedValue(
      ok(sdKbArticleDTO({ archivedAt: '2026-10-06T00:00:00.000Z' })),
    )
    const out = expectOk(
      await sdDeleteKbDraftTool.execute(ctx, { article: ID }),
    )
    expect(out.summary).toBe(
      'Rascunho “Como reiniciar o servidor de e-mail” enviado para a lixeira',
    )
    expect(kb.archive).toHaveBeenCalledWith('user-me', 'ws1', 'kb-1')
    kb.archive.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await sdDeleteKbDraftTool.execute(ctx, { article: ID }),
      'SD_NOT_AGENT',
    )
  })

  it('should surface lookup and slug errors', async () => {
    kb.search.mockResolvedValue(ok([]))
    expectErr(
      await sdPreview(sdDeleteKbDraftTool, ctx, { article: 'nada' }),
      'VALIDATION_ERROR',
    )
    kb.search.mockResolvedValue(ok([sdKbSearchDTO()]))
    kb.getById.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await sdPreview(sdDeleteKbDraftTool, ctx, { article: 'Como' }),
      'DATABASE_ERROR',
    )
    kb.getById.mockResolvedValue(ok(sdKbArticleDTO({ status: 'DRAFT' })))
    slugFails()
    expectErr(
      await sdPreview(sdDeleteKbDraftTool, ctx, { article: 'Como' }),
      'DATABASE_ERROR',
    )
  })
})

describe('sd_catalog', () => {
  it('should list active catalog entries with paths and departments', async () => {
    const out = expectOk(
      await sdCatalogTool.execute(
        ctx,
        expectOk(sdCatalogTool.parse({ query: 'wi-fi', practice: 'incident' })),
      ),
    )
    expect(out.data).toEqual({
      total: 2,
      items: [
        expect.objectContaining({ path: 'Rede > Wi-Fi', practices: 'todas' }),
        expect.objectContaining({
          id: 'svc-wifi-access',
          path: 'Rede > Wi-Fi > Liberar acesso',
          department: 'Redes',
        }),
      ],
    })
    const changes = expectOk(
      await sdCatalogTool.execute(
        ctx,
        expectOk(sdCatalogTool.parse({ practice: 'change', limit: 50 })),
      ),
    )
    const items = (
      changes.data as {
        items: { path: string; practices: unknown; department: unknown }[]
      }
    ).items
    expect(items.find((i) => i.path === 'Infra')).toMatchObject({
      practices: ['Mudança'],
      department: null,
    })
    expect(items.some((i) => i.path === 'Legado')).toBe(false)
    const all = expectOk(
      await sdCatalogTool.execute(ctx, expectOk(sdCatalogTool.parse({}))),
    )
    expect((all.data as { total: number }).total).toBe(6)
  })

  it('should surface config errors', async () => {
    vi.mocked(SdConfigService.bootstrap).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(
      await sdCatalogTool.execute(ctx, expectOk(sdCatalogTool.parse({}))),
      'DATABASE_ERROR',
    )
  })

  it('should map unknown department ids to null', async () => {
    const config = sdConfigDTO()
    config.categories[0].departmentId = 'gone'
    vi.mocked(SdConfigService.bootstrap).mockResolvedValue(ok(config))
    const out = expectOk(
      await sdCatalogTool.execute(
        ctx,
        expectOk(sdCatalogTool.parse({ query: 'rede', limit: 1 })),
      ),
    )
    expect(out.data).toMatchObject({
      items: [{ id: 'cat-net', department: null }],
    })
  })
})

describe('CMDB tools', () => {
  it('should search config items with a resolved customer', async () => {
    vi.mocked(SdCustomerService.list).mockResolvedValue(page([sdCustomerDTO()]))
    vi.mocked(SdConfigItemService.list).mockResolvedValue(
      page(
        [
          sdConfigItemDTO(),
          sdConfigItemDTO({
            id: 'ci-9',
            type: null,
            customer: null,
            department: null,
          }),
        ],
        30,
      ),
    )
    const out = expectOk(
      await sdSearchConfigItemsTool.execute(
        ctx,
        expectOk(
          sdSearchConfigItemsTool.parse({
            query: 'srv',
            status: 'ACTIVE',
            customer: 'Acme',
            limit: 2,
          }),
        ),
      ),
    )
    expect(out.data).toMatchObject({
      total: 30,
      hasMore: true,
      href: '/acme/servicedesk/config-items',
      items: [
        { id: 'ci-1', type: 'Servidor', customer: 'Acme Ltda' },
        { id: 'ci-9', type: null, customer: null, department: null },
      ],
    })
    expect(SdConfigItemService.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({
        customerId: 'cust-1',
        status: 'ACTIVE',
        pageSize: 2,
      }),
    )
  })

  it('should surface search errors', async () => {
    vi.mocked(SdCustomerService.list).mockResolvedValue(page([]))
    expectErr(
      await sdSearchConfigItemsTool.execute(
        ctx,
        expectOk(sdSearchConfigItemsTool.parse({ customer: 'Nada' })),
      ),
      'VALIDATION_ERROR',
    )
    const args = expectOk(sdSearchConfigItemsTool.parse({}))
    vi.mocked(SdConfigItemService.list).mockResolvedValue(err(sdNotAgent()))
    expectErr(await sdSearchConfigItemsTool.execute(ctx, args), 'SD_NOT_AGENT')
    vi.mocked(SdConfigItemService.list).mockResolvedValue(page([]))
    slugFails()
    expectErr(
      await sdSearchConfigItemsTool.execute(ctx, args),
      'DATABASE_ERROR',
    )
  })

  it('should get a config item with hierarchy and recent tickets', async () => {
    vi.mocked(SdConfigItemService.get).mockResolvedValue(ok(sdConfigItemDTO()))
    const out = expectOk(
      await sdGetConfigItemTool.execute(ctx, { configItem: ID }),
    )
    expect(out.summary).toBe('srv-mail-01 (CI-001): ACTIVE')
    expect(out.data).toMatchObject({
      owner: 'Ana Agente',
      ancestors: ['rack-01'],
      children: [{ id: 'ci-2' }],
      recentTickets: [{ number: 42, href: '/acme/servicedesk/tickets/42' }],
    })
    vi.mocked(SdConfigItemService.get).mockResolvedValue(
      ok(
        sdConfigItemDTO({
          code: null,
          type: null,
          customer: null,
          department: null,
          owner: null,
        }),
      ),
    )
    const bare = expectOk(
      await sdGetConfigItemTool.execute(ctx, { configItem: ID }),
    )
    expect(bare.summary).toBe('srv-mail-01: ACTIVE')
  })

  it('should surface get errors', async () => {
    vi.mocked(SdConfigItemService.list).mockResolvedValue(page([]))
    expectErr(
      await sdGetConfigItemTool.execute(ctx, { configItem: 'nada' }),
      'VALIDATION_ERROR',
    )
    vi.mocked(SdConfigItemService.get).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(
      await sdGetConfigItemTool.execute(ctx, { configItem: ID }),
      'DATABASE_ERROR',
    )
    vi.mocked(SdConfigItemService.get).mockResolvedValue(ok(sdConfigItemDTO()))
    slugFails()
    expectErr(
      await sdGetConfigItemTool.execute(ctx, { configItem: ID }),
      'DATABASE_ERROR',
    )
  })
})

describe('sd_search_customers', () => {
  it('should never return documents or full addresses', async () => {
    vi.mocked(SdCustomerService.list).mockResolvedValue(
      page([sdCustomerDTO(), sdCustomerDTO({ id: 'c2', kind: 'COMPANY' })]),
    )
    const out = expectOk(
      await sdSearchCustomersTool.execute(
        ctx,
        expectOk(
          sdSearchCustomersTool.parse({ query: 'acme', kind: 'company' }),
        ),
      ),
    )
    const items = (out.data as { items: Record<string, unknown>[] }).items
    expect(items[0]).not.toHaveProperty('document')
    expect(items[0]).not.toHaveProperty('street')
    expect(items.map((i) => i.href)).toEqual([
      '/acme/servicedesk/customers',
      '/acme/servicedesk/companies',
    ])
    expect(SdCustomerService.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({ kind: 'COMPANY' }),
    )
    expectOk(
      await sdSearchCustomersTool.execute(
        ctx,
        expectOk(sdSearchCustomersTool.parse({ kind: 'client' })),
      ),
    )
    expect(SdCustomerService.list).toHaveBeenLastCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({ kind: 'CLIENT' }),
    )
  })

  it('should surface list and slug errors', async () => {
    const args = expectOk(sdSearchCustomersTool.parse({}))
    vi.mocked(SdCustomerService.list).mockResolvedValue(err(sdNotAgent()))
    expectErr(await sdSearchCustomersTool.execute(ctx, args), 'SD_NOT_AGENT')
    vi.mocked(SdCustomerService.list).mockResolvedValue(page([]))
    slugFails()
    expectErr(await sdSearchCustomersTool.execute(ctx, args), 'DATABASE_ERROR')
  })
})

describe('sd_search_contacts', () => {
  it('should list contacts of a customer', async () => {
    vi.mocked(SdCustomerService.list).mockResolvedValue(page([sdCustomerDTO()]))
    vi.mocked(SdContactService.list).mockResolvedValue(
      page([sdContactDTO(), sdContactDTO({ id: 'c2', userId: 'u' })]),
    )
    const out = expectOk(
      await sdSearchContactsTool.execute(
        ctx,
        expectOk(sdSearchContactsTool.parse({ query: 'jo', customer: 'Acme' })),
      ),
    )
    expect(out.data).toMatchObject({
      items: [
        { id: 'contact-1', customers: ['Acme Ltda'], hasPlatformUser: false },
        { id: 'c2', hasPlatformUser: true },
      ],
    })
    expect(SdContactService.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({ q: 'jo', customerId: 'cust-1' }),
    )
  })

  it('should surface lookup, list and slug errors', async () => {
    vi.mocked(SdCustomerService.list).mockResolvedValue(page([]))
    expectErr(
      await sdSearchContactsTool.execute(
        ctx,
        expectOk(sdSearchContactsTool.parse({ customer: 'Nada' })),
      ),
      'VALIDATION_ERROR',
    )
    const args = expectOk(sdSearchContactsTool.parse({}))
    vi.mocked(SdContactService.list).mockResolvedValue(err(sdNotAgent()))
    expectErr(await sdSearchContactsTool.execute(ctx, args), 'SD_NOT_AGENT')
    vi.mocked(SdContactService.list).mockResolvedValue(page([]))
    slugFails()
    expectErr(await sdSearchContactsTool.execute(ctx, args), 'DATABASE_ERROR')
  })
})
