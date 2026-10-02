import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdKbArticle } from '@/src/__tests__/factories/sd-kb.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import {
  databaseError,
  sdKbArticleNotFound,
  sdTicketNotFound,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdKbTicketRef } from '@/src/repositories/sd-kb-ticket-link.repository'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-kb-article.repository')
vi.mock('@/src/repositories/sd-kb-ticket-link.repository')
vi.mock('@/src/repositories/sd-kb-review.repository')
vi.mock('@/lib/axiom/audit')

import { auditMutation } from '@/lib/axiom/audit'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbReviewRepository } from '@/src/repositories/sd-kb-review.repository'
import { SdKbTicketLinkRepository } from '@/src/repositories/sd-kb-ticket-link.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  SdKbTicketLinkService,
  sdKbTermsFromTitle,
} from '../sd-kb-ticket-link.service'

const articles = vi.mocked(SdKbArticleRepository)
const links = vi.mocked(SdKbTicketLinkRepository)
const reviews = vi.mocked(SdKbReviewRepository)
const moduleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const ticket: SdKbTicketRef = {
  id: 't1',
  workspaceId: WS,
  title: 'VPN não conecta no notebook',
  categoryId: 'c1',
  subcategoryId: null,
  serviceId: 's1',
  requesterId: 'req',
  createdById: 'creator',
  tags: [],
  participantIds: ['part'],
}
const article = createFakeSdKbArticle({ id: 'a1', workspaceId: WS })
const link = {
  ticketId: 't1',
  articleId: 'a1',
  linkedById: 'u1',
  resolvedTicket: false,
  createdAt: new Date(),
  article,
}

beforeEach(() => {
  moduleAccess.isEnabled.mockResolvedValue(ok(true))
  links.findTicket.mockResolvedValue(ok(ticket))
})

describe('sdKbTermsFromTitle', () => {
  it('keeps unique words with 3+ letters/digits, lowercased, max 10', () => {
    expect(sdKbTermsFromTitle('VPN não conecta: erro 809 na VPN!')).toEqual([
      'vpn',
      'não',
      'conecta',
      'erro',
      '809',
    ])
    expect(sdKbTermsFromTitle('')).toEqual([])
    expect(
      sdKbTermsFromTitle(
        Array.from({ length: 12 }, (_, i) => `w${i}xx`).join(' '),
      ),
    ).toHaveLength(10)
  })
})

describe('SdKbTicketLinkService', () => {
  describe('listForTicket()', () => {
    it('lists every link for agents', async () => {
      actAs('agent')
      links.listByTicket.mockResolvedValue(ok([link]))
      const rows = expectOk(
        await SdKbTicketLinkService.listForTicket('u1', WS, 't1'),
      )
      expect(rows[0]).toMatchObject({ ticketId: 't1', article: { id: 'a1' } })
      expect(links.listByTicket).toHaveBeenCalledWith('t1', {
        portalOnly: false,
      })
    })

    it.each(['req', 'creator', 'part'])(
      'lets the requester-side user %s see portal links',
      async (userId) => {
        actAs('requester')
        links.listByTicket.mockResolvedValue(ok([]))
        expectOk(await SdKbTicketLinkService.listForTicket(userId, WS, 't1'))
        expect(links.listByTicket).toHaveBeenCalledWith('t1', {
          portalOnly: true,
        })
      },
    )

    it("refuses other requesters' tickets and propagates failures", async () => {
      actAs('requester')
      expectErr(
        await SdKbTicketLinkService.listForTicket('stranger', WS, 't1'),
        'SD_TICKET_FORBIDDEN',
      )
      actAs('agent')
      links.findTicket.mockResolvedValue(err(sdTicketNotFound()))
      expectErr(
        await SdKbTicketLinkService.listForTicket('u1', WS, 'other'),
        'SD_TICKET_NOT_FOUND',
      )
      links.findTicket.mockResolvedValue(ok(ticket))
      links.listByTicket.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbTicketLinkService.listForTicket('u1', WS, 't1'),
        'DATABASE_ERROR',
      )
      actAs('non-member')
      expectErr(
        await SdKbTicketLinkService.listForTicket('u1', WS, 't1'),
        'FORBIDDEN',
      )
    })
  })

  describe('link()', () => {
    it('links an article of the workspace and audits', async () => {
      actAs('agent')
      articles.findById.mockResolvedValue(ok(article))
      links.link.mockResolvedValue(ok(link))
      expectOk(await SdKbTicketLinkService.link('u1', WS, 't1', 'a1'))
      expect(articles.findById).toHaveBeenCalledWith('a1', WS)
      expect(links.link).toHaveBeenCalledWith({
        ticketId: 't1',
        articleId: 'a1',
        linkedById: 'u1',
      })
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'sd_ticket_kb_link',
          action: 'create',
          meta: { articleId: 'a1' },
        }),
      )
    })

    it('refuses requesters, viewers and cross-workspace ids', async () => {
      actAs('requester')
      expectErr(
        await SdKbTicketLinkService.link('u1', WS, 't1', 'a1'),
        'SD_NOT_AGENT',
      )
      actAs('viewer-agent')
      expectErr(
        await SdKbTicketLinkService.link('u1', WS, 't1', 'a1'),
        'FORBIDDEN',
      )

      actAs('agent')
      links.findTicket.mockResolvedValue(err(sdTicketNotFound()))
      expectErr(
        await SdKbTicketLinkService.link('u1', WS, 'x', 'a1'),
        'SD_TICKET_NOT_FOUND',
      )
      links.findTicket.mockResolvedValue(ok(ticket))
      articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
      expectErr(
        await SdKbTicketLinkService.link('u1', WS, 't1', 'x'),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      articles.findById.mockResolvedValue(ok(article))
      links.link.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbTicketLinkService.link('u1', WS, 't1', 'a1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('unlink()', () => {
    it('unlinks and audits', async () => {
      actAs('agent')
      links.unlink.mockResolvedValue(ok(undefined))
      expectOk(await SdKbTicketLinkService.unlink('u1', WS, 't1', 'a1'))
      expect(links.unlink).toHaveBeenCalledWith('t1', 'a1')
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete' }),
      )
    })

    it('propagates failures', async () => {
      actAs('requester')
      expectErr(
        await SdKbTicketLinkService.unlink('u1', WS, 't1', 'a1'),
        'SD_NOT_AGENT',
      )
      actAs('agent')
      links.findTicket.mockResolvedValue(err(sdTicketNotFound()))
      expectErr(
        await SdKbTicketLinkService.unlink('u1', WS, 't1', 'a1'),
        'SD_TICKET_NOT_FOUND',
      )
      links.findTicket.mockResolvedValue(ok(ticket))
      links.unlink.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbTicketLinkService.unlink('u1', WS, 't1', 'a1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('suggest()', () => {
    it('suggests by title terms and ticket categories', async () => {
      actAs('agent')
      articles.suggest.mockResolvedValue(
        ok([{ ...article, plainText: 'reinicie a vpn', rank: 0.7 }]),
      )
      const rows = expectOk(
        await SdKbTicketLinkService.suggest('u1', WS, {
          ticketId: 't1',
          limit: 3,
        }),
      )
      expect(rows[0]).toMatchObject({ id: 'a1', rank: 0.7 })
      expect(articles.suggest).toHaveBeenCalledWith(WS, {
        terms: ['vpn', 'não', 'conecta', 'notebook'],
        categoryIds: ['c1', 's1'],
        limit: 3,
        portalOnly: false,
      })
    })

    it('refuses requesters and propagates failures', async () => {
      actAs('requester')
      expectErr(
        await SdKbTicketLinkService.suggest('u1', WS, {
          ticketId: 't1',
          limit: 5,
        }),
        'SD_NOT_AGENT',
      )
      actAs('agent')
      links.findTicket.mockResolvedValue(err(sdTicketNotFound()))
      expectErr(
        await SdKbTicketLinkService.suggest('u1', WS, {
          ticketId: 'x',
          limit: 5,
        }),
        'SD_TICKET_NOT_FOUND',
      )
      links.findTicket.mockResolvedValue(ok(ticket))
      articles.suggest.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbTicketLinkService.suggest('u1', WS, {
          ticketId: 't1',
          limit: 5,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('markResolved()', () => {
    beforeEach(() => {
      actAs('agent')
      articles.findById.mockResolvedValue(ok(article))
      links.link.mockResolvedValue(ok(link))
      reviews.markResolved.mockResolvedValue(
        ok({
          link: { ...link, resolvedTicket: true, article },
          changed: true,
        }),
      )
    })

    it('marks the resolver, linking the article on the spot', async () => {
      const dto = expectOk(
        await SdKbTicketLinkService.markResolved('u1', WS, 'a1', {
          ticketId: 't1',
          resolved: true,
        }),
      )
      expect(dto.resolvedTicket).toBe(true)
      expect(links.link).toHaveBeenCalledWith({
        ticketId: 't1',
        articleId: 'a1',
        linkedById: 'u1',
      })
      expect(reviews.markResolved).toHaveBeenCalledWith('t1', 'a1', true)
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'sd_ticket_kb_link',
          action: 'resolve',
        }),
      )
    })

    it('unmarking does not create a link', async () => {
      reviews.markResolved.mockResolvedValue(
        ok({ link: { ...link, resolvedTicket: false }, changed: true }),
      )
      const dto = expectOk(
        await SdKbTicketLinkService.markResolved('u1', WS, 'a1', {
          ticketId: 't1',
          resolved: false,
        }),
      )
      expect(dto.resolvedTicket).toBe(false)
      expect(links.link).not.toHaveBeenCalled()
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'unresolve' }),
      )
    })

    it('refuses requesters and propagates failures', async () => {
      actAs('requester')
      expectErr(
        await SdKbTicketLinkService.markResolved('u1', WS, 'a1', {
          ticketId: 't1',
          resolved: true,
        }),
        'SD_NOT_AGENT',
      )
      actAs('agent')
      links.findTicket.mockResolvedValue(err(sdTicketNotFound()))
      expectErr(
        await SdKbTicketLinkService.markResolved('u1', WS, 'a1', {
          ticketId: 't1',
          resolved: true,
        }),
        'SD_TICKET_NOT_FOUND',
      )
      links.findTicket.mockResolvedValue(ok(ticket))
      articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
      expectErr(
        await SdKbTicketLinkService.markResolved('u1', WS, 'a1', {
          ticketId: 't1',
          resolved: true,
        }),
        'SD_KB_ARTICLE_NOT_FOUND',
      )
      articles.findById.mockResolvedValue(ok(article))
      links.link.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbTicketLinkService.markResolved('u1', WS, 'a1', {
          ticketId: 't1',
          resolved: true,
        }),
        'DATABASE_ERROR',
      )
      links.link.mockResolvedValue(ok(link))
      reviews.markResolved.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbTicketLinkService.markResolved('u1', WS, 'a1', {
          ticketId: 't1',
          resolved: true,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('suggestForDraft()', () => {
    it('suggests from the typed title and description (agent sees internal)', async () => {
      actAs('agent')
      articles.suggest.mockResolvedValue(
        ok([{ ...article, plainText: 'reinicie a vpn', rank: 0.4 }]),
      )
      const rows = expectOk(
        await SdKbTicketLinkService.suggestForDraft('u1', WS, {
          title: 'VPN não conecta',
          description: 'erro 809 no notebook',
          categoryIds: ['c1'],
          limit: 4,
        }),
      )
      expect(rows[0]).toMatchObject({ id: 'a1', rank: 0.4 })
      expect(articles.suggest).toHaveBeenCalledWith(WS, {
        terms: ['vpn', 'não', 'conecta', 'erro', '809', 'notebook'],
        categoryIds: ['c1'],
        limit: 4,
        portalOnly: false,
      })
    })

    it('requester only gets portal articles', async () => {
      actAs('requester')
      articles.suggest.mockResolvedValue(ok([]))
      expectOk(
        await SdKbTicketLinkService.suggestForDraft('u1', WS, {
          title: 'senha',
          description: '',
          categoryIds: [],
          limit: 5,
        }),
      )
      expect(articles.suggest).toHaveBeenCalledWith(
        WS,
        expect.objectContaining({ portalOnly: true }),
      )
    })

    it('refuses non-members', async () => {
      actAs('non-member')
      expectErr(
        await SdKbTicketLinkService.suggestForDraft('u1', WS, {
          title: 'vpn',
          description: '',
          categoryIds: [],
          limit: 5,
        }),
        'FORBIDDEN',
      )
    })

    it('propagates repository failures', async () => {
      actAs('agent')
      articles.suggest.mockResolvedValue(err(databaseError()))
      expectErr(
        await SdKbTicketLinkService.suggestForDraft('u1', WS, {
          title: 'vpn',
          description: '',
          categoryIds: [],
          limit: 5,
        }),
        'DATABASE_ERROR',
      )
    })
  })
})
