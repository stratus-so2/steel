import { describe, expect, it, vi } from 'vitest'
import {
  sdAgents,
  sdConfigDTO,
  sdConfigItemDTO,
  sdContactDTO,
  sdCustomerDTO,
  sdKbArticleDTO,
  sdKbSearchDTO,
  sdTicketDTO,
} from '@/src/__tests__/factories/steel-ai-sd.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdTicketNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/services/sd-config.service')
vi.mock('@/src/services/sd-ticket.service')
vi.mock('@/src/services/sd-customer.service')
vi.mock('@/src/services/sd-contact.service')
vi.mock('@/src/services/sd-config-item.service')
vi.mock('@/src/services/sd-kb-article.service')

import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { SdConfigService } from '@/src/services/sd-config.service'
import { SdConfigItemService } from '@/src/services/sd-config-item.service'
import { SdContactService } from '@/src/services/sd-contact.service'
import { SdCustomerService } from '@/src/services/sd-customer.service'
import { SdKbArticleService } from '@/src/services/sd-kb-article.service'
import { SdTicketService } from '@/src/services/sd-ticket.service'
import {
  lookupConfigItem,
  lookupContact,
  lookupCustomer,
  lookupKbArticle,
} from '../ai/tools/servicedesk/lookups'
import {
  clip,
  compactTicket,
  flattenCatalog,
  htmlText,
  loadSdConfig,
  looksLikeId,
  matchNamed,
  practiceSchema,
  resolveNamed,
  resolveUser,
  sdBasePath,
  show,
  textToSdHtml,
  zodParser,
} from '../ai/tools/servicedesk/shared'
import {
  assertOpen,
  changeLine,
  customFieldLines,
  loadOpenTicket,
  loadTicket,
  resolveClassification,
} from '../ai/tools/servicedesk/ticket-fields'

const ctx = {
  workspaceId: 'ws1',
  actorId: 'user-me',
  source: 'assistant' as const,
}
const ID = 'abcdefghijklmnopqrstuvwx'

function page<T>(items: T[]) {
  return ok({ items, total: items.length, page: 1, pageSize: 10 })
}

describe('shared helpers', () => {
  it('should parse with zod and map issues to a validation error', () => {
    const parse = zodParser(practiceSchema)
    expect(expectOk(parse('incidente' as never))).toBe('INCIDENT')
    expect(expectOk(parse('request' as never))).toBe('SERVICE_REQUEST')
    expect(expectOk(parse('change' as never))).toBe('CHANGE')
    expectErr(parse('banana' as never), 'VALIDATION_ERROR')
    expectErr(zodParser(practiceSchema)(undefined as never), 'VALIDATION_ERROR')
  })

  it('should keep non-string practices for zod to reject', () => {
    expect(practiceSchema.safeParse(3).success).toBe(false)
  })

  it('should clip, strip html and convert text to paragraphs', () => {
    expect(clip(null, 3)).toBeNull()
    expect(clip('abcdef', 3)).toBe('abc…')
    expect(clip('ab', 3)).toBe('ab')
    expect(htmlText(null, 10)).toBeNull()
    expect(htmlText('<p>Olá <b>mundo</b></p>', 50)).toBe('Olá mundo')
    expect(textToSdHtml('a <b>\nlinha\n\n\nb')).toBe(
      '<p>a &lt;b&gt;<br>linha</p><p>b</p>',
    )
  })

  it('should format preview values', () => {
    expect(show(null)).toBeNull()
    expect(show('')).toBeNull()
    expect(show(true)).toBe('Sim')
    expect(show(false)).toBe('Não')
    expect(show(3)).toBe('3')
  })

  it('should detect cuid-like ids', () => {
    expect(looksLikeId(ID)).toBe(true)
    expect(looksLikeId('Acme Ltda')).toBe(false)
  })

  it('should build the base path from the workspace slug', async () => {
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      ok({ slug: 'acme' } as never),
    )
    expect(expectOk(await sdBasePath(ctx))).toBe('/acme/servicedesk')
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await sdBasePath(ctx), 'DATABASE_ERROR')
  })

  it('should compact a ticket with fallbacks for contact and company', () => {
    const compact = compactTicket(
      sdTicketDTO({
        contact: {
          id: 'c',
          name: 'Joana',
          email: null,
          phone: null,
          userId: null,
        },
        company: { id: 'co', name: 'Acme', tradeName: null, document: null },
        risk: {
          level: 'HIGH',
          score: 80,
          factors: [],
          breachEtaAt: null,
          computedAt: '',
        },
      }),
      '/acme/servicedesk',
    )
    expect(compact).toMatchObject({
      requester: 'Joana',
      customer: 'Acme',
      risk: { level: 'HIGH', score: 80 },
      href: '/acme/servicedesk/tickets/42',
    })
  })

  it('should load the config through the SD config service', async () => {
    vi.mocked(SdConfigService.bootstrap).mockResolvedValue(ok(sdConfigDTO()))
    expectOk(await loadSdConfig(ctx))
    expect(SdConfigService.bootstrap).toHaveBeenCalledWith('user-me', 'ws1')
  })

  it('should flatten the catalog with paths and level ids', () => {
    const entry = flattenCatalog(sdConfigDTO()).find(
      (e) => e.id === 'svc-wifi-access',
    )
    expect(entry).toMatchObject({
      path: 'Rede > Wi-Fi > Liberar acesso',
      categoryId: 'cat-net',
      subcategoryId: 'sub-wifi',
      serviceId: 'svc-wifi-access',
    })
  })
})

describe('name resolution', () => {
  const items = [
    { id: 'a', name: 'Suporte' },
    { id: 'b', name: 'Suporte N2' },
    { id: 'c', name: 'Redes', aliases: ['net@acme.com', null] },
  ]

  it('should match by id, exact name (accents/case) and alias', () => {
    expect(matchNamed(items, 'b').map((i) => i.id)).toEqual(['b'])
    expect(matchNamed(items, 'SUPORTE').map((i) => i.id)).toEqual(['a'])
    expect(matchNamed(items, 'net@acme.com').map((i) => i.id)).toEqual(['c'])
    expect(matchNamed(items, 'rêde').map((i) => i.id)).toEqual(['c'])
  })

  it('should return ambiguity with candidates and not-found errors', () => {
    const ambiguous = expectErr(
      resolveNamed(items, 'sup', 'o departamento'),
      'VALIDATION_ERROR',
    )
    expect(ambiguous.message).toContain('ambíguo')
    expect(ambiguous.details).toEqual({
      candidates: [
        { id: 'a', name: 'Suporte' },
        { id: 'b', name: 'Suporte N2' },
      ],
    })
    const missing = expectErr(
      resolveNamed(items, 'Financeiro', 'o departamento'),
    )
    expect(missing.message).toBe('Não encontrei o departamento "Financeiro"')
  })

  it('should resolve users by "me", e-mail and name', () => {
    const agents = sdAgents()
    expect(expectOk(resolveUser(ctx, agents, 'me', 'x')).id).toBe('user-me')
    expect(expectOk(resolveUser(ctx, agents, 'Eu', 'x')).id).toBe('user-me')
    expect(expectOk(resolveUser(ctx, agents, 'bruna@acme.com', 'x')).id).toBe(
      'user-bruna',
    )
    expectErr(resolveUser(ctx, agents, 'brun', 'x'), 'VALIDATION_ERROR')
    expectErr(
      resolveUser(ctx, agents.slice(1), 'me', 'agentes'),
      'VALIDATION_ERROR',
    )
  })
})

describe('directory lookups', () => {
  it('should take ids as is without searching', async () => {
    expect(expectOk(await lookupCustomer(ctx, ID)).id).toBe(ID)
    expect(expectOk(await lookupContact(ctx, ID)).id).toBe(ID)
    expect(expectOk(await lookupConfigItem(ctx, ID)).id).toBe(ID)
    expect(SdCustomerService.list).not.toHaveBeenCalled()
  })

  it('should search customers by name, trade name or e-mail', async () => {
    vi.mocked(SdCustomerService.list).mockResolvedValue(
      page([
        sdCustomerDTO(),
        sdCustomerDTO({ id: 'cust-2', name: 'Acme Sul', tradeName: null }),
      ]),
    )
    expect(expectOk(await lookupCustomer(ctx, 'acme')).id).toBe('cust-1')
    expect(SdCustomerService.list).toHaveBeenCalledWith(
      'user-me',
      'ws1',
      expect.objectContaining({ q: 'acme', kind: undefined }),
    )
    const error = expectErr(await lookupCustomer(ctx, 'Ac', 'COMPANY'))
    expect(error.message).toContain('a empresa')
    vi.mocked(SdCustomerService.list).mockResolvedValue(err(databaseError('x')))
    expectErr(await lookupCustomer(ctx, 'acme'), 'DATABASE_ERROR')
  })

  it('should search contacts and config items', async () => {
    vi.mocked(SdContactService.list).mockResolvedValue(page([sdContactDTO()]))
    expect(expectOk(await lookupContact(ctx, 'joana@acme.com')).id).toBe(
      'contact-1',
    )
    vi.mocked(SdContactService.list).mockResolvedValue(err(databaseError('x')))
    expectErr(await lookupContact(ctx, 'joana'), 'DATABASE_ERROR')

    vi.mocked(SdConfigItemService.list).mockResolvedValue(
      page([sdConfigItemDTO()]),
    )
    expect(expectOk(await lookupConfigItem(ctx, '10.0.0.5')).id).toBe('ci-1')
    expect(expectOk(await lookupConfigItem(ctx, 'CI-001')).id).toBe('ci-1')
    vi.mocked(SdConfigItemService.list).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await lookupConfigItem(ctx, 'srv'), 'DATABASE_ERROR')
  })

  it('should resolve KB articles by id, title or a single search hit', async () => {
    vi.mocked(SdKbArticleService.getById).mockResolvedValue(
      ok(sdKbArticleDTO()),
    )
    expect(expectOk(await lookupKbArticle(ctx, ID)).id).toBe('kb-1')
    vi.mocked(SdKbArticleService.getById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await lookupKbArticle(ctx, ID), 'DATABASE_ERROR')

    vi.mocked(SdKbArticleService.search).mockResolvedValue(
      ok([sdKbSearchDTO(), sdKbSearchDTO({ id: 'kb-2', title: 'Outro' })]),
    )
    expect(
      expectOk(
        await lookupKbArticle(ctx, 'Como reiniciar o servidor de e-mail'),
      ).id,
    ).toBe('kb-1')
    expectErr(await lookupKbArticle(ctx, 'xyz'), 'VALIDATION_ERROR')

    vi.mocked(SdKbArticleService.search).mockResolvedValue(
      ok([sdKbSearchDTO({ id: 'kb-9', title: 'Reiniciar' })]),
    )
    expect(expectOk(await lookupKbArticle(ctx, 'servidor travado')).id).toBe(
      'kb-9',
    )

    vi.mocked(SdKbArticleService.search).mockResolvedValue(ok([]))
    const missing = expectErr(await lookupKbArticle(ctx, 'nada'))
    expect(missing.message).toBe('Não encontrei o artigo "nada"')

    vi.mocked(SdKbArticleService.search).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await lookupKbArticle(ctx, 'nada'), 'DATABASE_ERROR')
  })
})

describe('ticket helpers', () => {
  it('should load a ticket with its deep link', async () => {
    vi.mocked(SdTicketService.get).mockResolvedValue(ok(sdTicketDTO()))
    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      ok({ slug: 'acme' } as never),
    )
    const loaded = expectOk(await loadTicket(ctx, '42'))
    expect(loaded.href).toBe('/acme/servicedesk/tickets/42')
    expect(SdTicketService.get).toHaveBeenCalledWith('user-me', 'ws1', '42')

    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await loadTicket(ctx, '42'), 'DATABASE_ERROR')
    vi.mocked(SdTicketService.get).mockResolvedValue(err(sdTicketNotFound()))
    expectErr(await loadTicket(ctx, '42'), 'SD_TICKET_NOT_FOUND')
  })

  it('should refuse closed or canceled tickets for messages and tasks', async () => {
    const closed = sdTicketDTO({
      phase: { ...sdTicketDTO().phase, category: 'CLOSED' },
    })
    expectErr(assertOpen(closed), 'SD_TICKET_CLOSED')
    expectErr(
      assertOpen(
        sdTicketDTO({
          phase: { ...sdTicketDTO().phase, category: 'CANCELED' },
        }),
      ),
      'SD_TICKET_CLOSED',
    )
    expectOk(assertOpen(sdTicketDTO()))

    vi.mocked(WorkspaceRepository.findById).mockResolvedValue(
      ok({ slug: 'acme' } as never),
    )
    vi.mocked(SdTicketService.get).mockResolvedValue(ok(closed))
    expectErr(await loadOpenTicket(ctx, '42'), 'SD_TICKET_CLOSED')
    vi.mocked(SdTicketService.get).mockResolvedValue(err(sdTicketNotFound()))
    expectErr(await loadOpenTicket(ctx, '42'), 'SD_TICKET_NOT_FOUND')
  })

  it('should resolve scales and show the matrix priority', () => {
    const resolved = expectOk(
      resolveClassification(sdConfigDTO(), 'INCIDENT', {
        impact: 'Alto',
        urgency: 'alta',
        severity: 'Sev 1',
      }),
    )
    expect(resolved.ids).toEqual({
      impactId: 'imp-high',
      urgencyId: 'urg-high',
      severityId: 'sev-1',
    })
    expect(resolved.labels.priority).toBe('Crítica (matriz impacto × urgência)')
  })

  it('should use the current ticket for the other matrix axis', () => {
    const current = sdTicketDTO({
      urgency: { id: 'urg-low', name: 'Baixa', level: 1, color: null },
    })
    const resolved = expectOk(
      resolveClassification(
        sdConfigDTO(),
        'INCIDENT',
        { impact: 'Baixo' },
        current,
      ),
    )
    expect(resolved.labels.priority).toContain('Baixa')
    const noCell = expectOk(
      resolveClassification(
        sdConfigDTO(),
        'INCIDENT',
        { impact: 'Alto' },
        current,
      ),
    )
    expect(noCell.labels.priority).toBeUndefined()
  })

  it('should keep an explicit priority and report unknown scale names', () => {
    const resolved = expectOk(
      resolveClassification(sdConfigDTO(), 'INCIDENT', {
        priority: 'Crítica',
        impact: 'Alto',
      }),
    )
    expect(resolved.ids.priorityId).toBe('pri-crit')
    expect(resolved.labels.priority).toBe('Crítica')
    expectErr(
      resolveClassification(sdConfigDTO(), 'INCIDENT', { urgency: 'Média' }),
      'VALIDATION_ERROR',
    )
  })

  it('should resolve the deepest catalog level and derive its parents', () => {
    const resolved = expectOk(
      resolveClassification(sdConfigDTO(), 'INCIDENT', {
        service: 'Liberar acesso',
        subcategory: 'wi-fi',
      }),
    )
    expect(resolved.ids).toEqual({
      categoryId: 'cat-net',
      subcategoryId: 'sub-wifi',
      serviceId: 'svc-wifi-access',
    })
    expect(resolved.labels.catalog).toBe('Rede > Wi-Fi > Liberar acesso')
  })

  it('should flag ambiguous catalog names and respect practices', () => {
    const ambiguous = expectErr(
      resolveClassification(sdConfigDTO(), 'INCIDENT', {
        service: 'Liberar acesso',
      }),
    )
    expect(ambiguous.message).toContain('ambíguo para o serviço')
    expect(
      expectOk(
        resolveClassification(sdConfigDTO(), 'INCIDENT', {
          service: 'Rede > VPN > Liberar acesso',
        }),
      ).ids.serviceId,
    ).toBe('svc-vpn-access')
    expectErr(
      resolveClassification(sdConfigDTO(), 'INCIDENT', { category: 'Infra' }),
      'VALIDATION_ERROR',
    )
    expect(
      expectOk(
        resolveClassification(sdConfigDTO(), 'CHANGE', { category: 'Infra' }),
      ).ids,
    ).toEqual({ categoryId: 'cat-chg', subcategoryId: null, serviceId: null })
    expectErr(
      resolveClassification(sdConfigDTO(), 'INCIDENT', { category: 'Legado' }),
      'VALIDATION_ERROR',
    )
  })

  it('should label custom fields and reject unknown keys', () => {
    expect(expectOk(customFieldLines(sdConfigDTO(), undefined))).toEqual([])
    expect(
      expectOk(
        customFieldLines(
          sdConfigDTO(),
          { asset_tag: { n: 1 } },
          { asset_tag: 'PAT-1' },
        ),
      ),
    ).toEqual([{ label: 'Patrimônio', before: 'PAT-1', after: '{"n":1}' }])
    expect(
      expectOk(customFieldLines(sdConfigDTO(), { asset_tag: null }, {})),
    ).toEqual([{ label: 'Patrimônio', before: null, after: null }])
    expectErr(customFieldLines(sdConfigDTO(), { nope: 1 }), 'VALIDATION_ERROR')
  })

  it('should emit a change line only when the value changes', () => {
    expect(changeLine('Título', 'a', 'a')).toEqual([])
    expect(changeLine('Título', undefined, null)).toEqual([])
    expect(changeLine('Título', 'a', 'b')).toEqual([
      { label: 'Título', before: 'a', after: 'b' },
    ])
  })
})
