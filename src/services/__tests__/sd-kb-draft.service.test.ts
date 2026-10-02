import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdKbArticle } from '@/src/__tests__/factories/sd-kb.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { aiQuotaExceeded, databaseError, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-kb-article.repository')
vi.mock('@/src/repositories/sd-kb-ticket-link.repository')
vi.mock('@/src/repositories/sd-ticket.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/sd-ai.repository')
vi.mock('@/src/services/ai-usage.service')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { SdAiRepository } from '@/src/repositories/sd-ai.repository'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbTicketLinkRepository } from '@/src/repositories/sd-kb-ticket-link.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { AiUsageService } from '@/src/services/ai-usage.service'
import { SdKbDraftService } from '../sd-kb-draft.service'

const articles = vi.mocked(SdKbArticleRepository)
const links = vi.mocked(SdKbTicketLinkRepository)
const tickets = vi.mocked(SdTicketRepository)
const context = vi.mocked(SdTicketContextRepository)
const aiRepo = vi.mocked(SdAiRepository)
const ai = vi.mocked(AiUsageService)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const ACTOR = 'u1'

const ticket: Record<string, unknown> = {
  id: 't1',
  workspaceId: WS,
  number: 123,
  type: 'INCIDENT',
  title: 'Re: VPN não conecta',
  description: '<p>Erro 809 ao conectar. Falar com ana@example.com</p>',
  solution: null,
  phase: { name: 'Novo' },
  priority: { name: 'Alta' },
  department: { name: 'Infra' },
  category: { id: 'c1', name: 'Acesso' },
  subcategory: null,
  service: { id: 's1', name: 'VPN' },
  categoryId: 'c1',
  subcategoryId: null,
  serviceId: 's1',
}

const created = createFakeSdKbArticle({ id: 'a1', workspaceId: WS })

function chat(text: string) {
  return {
    text,
    toolCalls: [],
    message: { role: 'assistant' as const, content: text },
    usage: { inputTokens: 100, outputTokens: 50 },
    stopReason: 'end' as const,
  }
}

const provider = { id: 'openai' as const, chat: vi.fn() }

beforeEach(() => {
  actAs('agent')
  tickets.findById.mockResolvedValue(ok(ticket as never))
  context.ensureSettings.mockResolvedValue(
    ok(createFakeSdSettings({ workspaceId: WS, aiEnabled: true })),
  )
  aiRepo.listTicketMessages.mockResolvedValue(
    ok([
      {
        authorKind: 'AGENT',
        visibility: 'PUBLIC',
        body: '<p>Reinstalamos o cliente.</p>',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        authorKind: 'REQUESTER',
        visibility: 'PUBLIC',
        body: '<p>Funcionou, obrigado!</p>',
        createdAt: new Date('2026-10-01T11:00:00.000Z'),
      },
    ] as never),
  )
  articles.create.mockResolvedValue(ok(created))
  articles.update.mockResolvedValue(ok(created))
  links.link.mockResolvedValue(ok({} as never))
  provider.chat.mockResolvedValue(
    chat(
      JSON.stringify({
        title: 'VPN não conecta (erro 809)',
        problem: ['O cliente VPN falha com erro 809.'],
        environment: ['Windows 11, cliente 5.2.'],
        cause: ['Perfil corrompido.'],
        solution: ['Reinstale o cliente.', 'Importe o perfil.'],
        validation: ['Conectar e abrir um recurso interno.'],
        tags: ['VPN', 'acesso'],
      }),
    ),
  )
  ai.prepare.mockResolvedValue(
    ok({
      feature: 'SERVICEDESK_COPILOT',
      provider: provider as never,
      model: { key: 'gpt', provider: 'openai', model: 'gpt-x' } as never,
      usdPer1kTokens: 4,
    }),
  )
  ai.record.mockResolvedValue(undefined)
})

describe('SdKbDraftService.fromTicket', () => {
  it('cria o rascunho com o texto da IA, vincula ao chamado e audita', async () => {
    const result = expectOk(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: true,
      }),
    )
    expect(result).toMatchObject({ aiUsed: true, aiSkippedReason: null })
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WS,
        title: 'VPN não conecta (erro 809)',
        categoryId: 's1',
        sourceTicketId: 't1',
        tags: ['vpn', 'acesso'],
        createdById: ACTOR,
      }),
    )
    const content = articles.update.mock.calls[0][1].content as {
      type: string
      children: { text: string }[]
    }[]
    const texts = content.map((block) => block.children[0].text)
    expect(texts).toContain('Problema')
    expect(texts).toContain('Reinstale o cliente.')
    expect(articles.update.mock.calls[0][1].plainText).toContain(
      'Reinstale o cliente.',
    )
    expect(links.link).toHaveBeenCalledWith({
      ticketId: 't1',
      articleId: 'a1',
      linkedById: ACTOR,
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_kb_article',
        action: 'create',
        meta: expect.objectContaining({ from: 'ticket', ai: true }),
      }),
    )
  })

  it('manda o chamado no prompt sem e-mail do cliente (ADR 0006)', async () => {
    await SdKbDraftService.fromTicket(ACTOR, WS, {
      ticketId: 't1',
      useAi: true,
    })
    const system = provider.chat.mock.calls[0][0].system as string
    expect(system).toContain('INC-000123')
    expect(system).toContain('[e-mail]')
    expect(system).not.toContain('ana@example.com')
    expect(provider.chat.mock.calls[0][0].jsonSchema?.name).toBe('kcs_draft')
  })

  it('lança o consumo da IA na cota', async () => {
    await SdKbDraftService.fromTicket(ACTOR, WS, {
      ticketId: 't1',
      useAi: true,
    })
    expect(ai.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workspaceId: WS,
        userId: ACTOR,
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    )
  })

  it('sem IA pedida entrega o esqueleto KCS e o título do chamado', async () => {
    const result = expectOk(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
    )
    expect(result).toMatchObject({
      aiUsed: false,
      aiSkippedReason: 'ai_not_requested',
    })
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'VPN não conecta' }),
    )
    expect(provider.chat).not.toHaveBeenCalled()
  })

  it.each([
    ['desligada no workspace', 'ai_disabled'],
    ['sem cota', 'AI_QUOTA_EXCEEDED'],
    ['saída inválida', 'ai_invalid_output'],
    ['provedor fora', 'ai_provider_unavailable'],
  ])('degrada para o esqueleto com a IA %s', async (_label, reason) => {
    if (reason === 'ai_disabled') {
      context.ensureSettings.mockResolvedValue(
        ok(createFakeSdSettings({ aiEnabled: false })),
      )
    }
    if (reason === 'AI_QUOTA_EXCEEDED') {
      ai.prepare.mockResolvedValue(err(aiQuotaExceeded(20, 20)))
    }
    if (reason === 'ai_invalid_output') {
      provider.chat.mockResolvedValue(chat('não é json'))
    }
    if (reason === 'ai_provider_unavailable') {
      provider.chat.mockRejectedValue(new Error('timeout'))
    }

    const result = expectOk(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: true,
      }),
    )
    expect(result).toMatchObject({ aiUsed: false, aiSkippedReason: reason })
    const content = articles.update.mock.calls[0][1].content as {
      children: { text: string }[]
    }[]
    expect(content.map((b) => b.children[0].text)).toContain('Validação')
  })

  it('usa a categoria pedida e o pai informado', async () => {
    await SdKbDraftService.fromTicket(ACTOR, WS, {
      ticketId: 't1',
      useAi: false,
      categoryId: 'escolhida',
      parentId: 'pai',
    })
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'escolhida', parentId: 'pai' }),
    )
  })

  it('segue quando o vínculo falha (o artigo já existe)', async () => {
    links.link.mockResolvedValue(err(databaseError('x')))
    expectOk(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
    )
  })

  it('recusa solicitante, não-membro e chamado inexistente', async () => {
    actAs('requester')
    expectErr(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
      'SD_NOT_AGENT',
    )
    actAs('non-member')
    expectErr(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
      'FORBIDDEN',
    )
    actAs('agent')
    tickets.findById.mockResolvedValue(err(sdTicketNotFound()))
    expectErr(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
      'SD_TICKET_NOT_FOUND',
    )
  })

  it('propaga erros do banco (configuração, histórico, criação, conteúdo)', async () => {
    context.ensureSettings.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
      'DATABASE_ERROR',
    )
    context.ensureSettings.mockResolvedValue(ok(createFakeSdSettings()))
    aiRepo.listTicketMessages.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
      'DATABASE_ERROR',
    )
    aiRepo.listTicketMessages.mockResolvedValue(ok([]))
    articles.create.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
      'DATABASE_ERROR',
    )
    articles.create.mockResolvedValue(ok(created))
    articles.update.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: false,
      }),
      'DATABASE_ERROR',
    )
  })

  it('cai na categoria do chamado quando não há serviço nem subcategoria', async () => {
    tickets.findById.mockResolvedValue(
      ok({ ...ticket, serviceId: null, service: null } as never),
    )
    await SdKbDraftService.fromTicket(ACTOR, WS, {
      ticketId: 't1',
      useAi: false,
    })
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'c1' }),
    )
  })

  it('sem catálogo nenhum, o artigo nasce sem categoria', async () => {
    tickets.findById.mockResolvedValue(
      ok({
        ...ticket,
        categoryId: null,
        subcategoryId: null,
        serviceId: null,
        category: null,
        service: null,
        priority: null,
        department: null,
        description: null,
      } as never),
    )
    await SdKbDraftService.fromTicket(ACTOR, WS, {
      ticketId: 't1',
      useAi: false,
    })
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: undefined }),
    )
  })

  it('título vazio da IA cai no título do chamado e autor desconhecido vira sistema', async () => {
    aiRepo.listTicketMessages.mockResolvedValue(
      ok([
        {
          authorKind: 'MONITOR',
          visibility: 'PUBLIC',
          body: '<p>Alerta do Zabbix.</p>',
          createdAt: new Date('2026-10-01T09:00:00.000Z'),
        },
      ] as never),
    )
    provider.chat.mockResolvedValue(
      chat(
        JSON.stringify({
          title: '   ',
          problem: ['A VPN cai.'],
          environment: [],
          cause: [],
          solution: [],
          validation: [],
          tags: [],
        }),
      ),
    )
    expectOk(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: true,
      }),
    )
    expect(articles.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'VPN não conecta', tags: undefined }),
    )
    const system = provider.chat.mock.calls[0][0].system as string
    expect(system).toContain('sistema')
  })

  it('erro não-Error do provedor também degrada para o esqueleto', async () => {
    provider.chat.mockRejectedValue('falhou feio')
    const result = expectOk(
      await SdKbDraftService.fromTicket(ACTOR, WS, {
        ticketId: 't1',
        useAi: true,
      }),
    )
    expect(result.aiSkippedReason).toBe('ai_provider_unavailable')
  })
})
