import { describe, expect, it, vi } from 'vitest'
import {
  seedSdKbArticle,
  seedSdKbReview,
  seedSdTicket,
} from '@/src/__tests__/factories/sd-kb.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdKbReviewRepository } from '../sd-kb-review.repository'
import { SdKbTicketLinkRepository } from '../sd-kb-ticket-link.repository'

const NOW = new Date('2026-10-02T12:00:00.000Z')

describe('SdKbReviewRepository — revisões', () => {
  it('cria, encontra, lista e decide a revisão pendente', async () => {
    const [ws, reviewer] = await Promise.all([seedWorkspace(), seedUser()])
    const article = await seedSdKbArticle(ws.id, { status: 'IN_REVIEW' })

    const created = expectOk(
      await SdKbReviewRepository.create({
        workspaceId: ws.id,
        articleId: article.id,
        reviewerId: reviewer.id,
        comment: 'confere o passo 3',
      }),
    )
    expect(created).toMatchObject({
      status: 'PENDING',
      comment: 'confere o passo 3',
      reviewerId: reviewer.id,
    })
    expect(created.reviewer?.name).toBe(reviewer.name)
    expect(created.article?.id).toBe(article.id)

    expectOk(await SdKbReviewRepository.findById(created.id, ws.id))
    const pending = expectOk(
      await SdKbReviewRepository.findPendingByArticle(article.id),
    )
    expect(pending?.id).toBe(created.id)

    const decided = expectOk(
      await SdKbReviewRepository.decide(created.id, {
        status: 'APPROVED',
        comment: null,
        decidedAt: NOW,
      }),
    )
    expect(decided.status).toBe('APPROVED')
    expect(decided.decidedAt).toEqual(NOW)
    expect(
      expectOk(await SdKbReviewRepository.findPendingByArticle(article.id)),
    ).toBeNull()

    const history = expectOk(
      await SdKbReviewRepository.listByArticle(article.id),
    )
    expect(history.map((r) => r.id)).toEqual([created.id])
  })

  it('esconde revisão de outro workspace e apaga a cancelada', async () => {
    const [a, b] = await Promise.all([seedWorkspace(), seedWorkspace()])
    const article = await seedSdKbArticle(b.id)
    const review = await seedSdKbReview(b.id, article.id)

    expectErr(
      await SdKbReviewRepository.findById(review.id, a.id),
      'SD_KB_REVIEW_NOT_FOUND',
    )
    expectOk(await SdKbReviewRepository.delete(review.id))
    expectErr(
      await SdKbReviewRepository.findById(review.id, b.id),
      'SD_KB_REVIEW_NOT_FOUND',
    )
  })

  it('lista a fila do workspace por status e por revisor, sem arquivados', async () => {
    const [ws, one, two] = await Promise.all([
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    const [first, second, archived] = await Promise.all([
      seedSdKbArticle(ws.id, { title: 'A' }),
      seedSdKbArticle(ws.id, { title: 'B' }),
      seedSdKbArticle(ws.id, { title: 'C', archivedAt: NOW }),
    ])
    await Promise.all([
      seedSdKbReview(ws.id, first.id, { reviewerId: one.id }),
      seedSdKbReview(ws.id, second.id, {
        reviewerId: two.id,
        status: 'APPROVED',
        decidedAt: NOW,
      }),
      seedSdKbReview(ws.id, archived.id, { reviewerId: one.id }),
    ])

    const all = expectOk(
      await SdKbReviewRepository.listByWorkspace(ws.id, { limit: 20 }),
    )
    expect(all).toHaveLength(2)
    const pending = expectOk(
      await SdKbReviewRepository.listByWorkspace(ws.id, {
        status: 'PENDING',
        limit: 20,
      }),
    )
    expect(pending.map((r) => r.articleId)).toEqual([first.id])
    const mine = expectOk(
      await SdKbReviewRepository.listByWorkspace(ws.id, {
        reviewerId: two.id,
        limit: 20,
      }),
    )
    expect(mine.map((r) => r.articleId)).toEqual([second.id])
  })
})

describe('SdKbReviewRepository — ciclo de vida do artigo', () => {
  it('manda para revisão, volta ao rascunho e publica carimbando a revisão', async () => {
    const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
    const article = await seedSdKbArticle(ws.id)

    const inReview = expectOk(
      await SdKbReviewRepository.markInReview(article.id, user.id),
    )
    expect(inReview).toMatchObject({
      status: 'IN_REVIEW',
      updatedById: user.id,
    })

    const draft = expectOk(
      await SdKbReviewRepository.markDraft(article.id, user.id),
    )
    expect(draft.status).toBe('DRAFT')

    const due = new Date('2027-04-01T12:00:00.000Z')
    const published = expectOk(
      await SdKbReviewRepository.publishReviewed(article.id, {
        updatedById: user.id,
        reviewedAt: NOW,
        reviewDueAt: due,
        reviewIntervalDays: 181,
      }),
    )
    expect(published).toMatchObject({
      status: 'PUBLISHED',
      publishedAt: NOW,
      lastReviewedAt: NOW,
      reviewDueAt: due,
      reviewIntervalDays: 181,
    })
  })

  it('troca a validade do artigo', async () => {
    const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
    const article = await seedSdKbArticle(ws.id, { status: 'PUBLISHED' })
    const updated = expectOk(
      await SdKbReviewRepository.setReviewInterval(article.id, {
        reviewIntervalDays: 30,
        reviewDueAt: NOW,
        updatedById: user.id,
      }),
    )
    expect(updated).toMatchObject({ reviewIntervalDays: 30, reviewDueAt: NOW })
  })

  it('devolve erro de banco quando o artigo não existe', async () => {
    expectErr(
      await SdKbReviewRepository.markInReview('missing', 'u1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdKbReviewRepository.markResolved', () => {
  async function linked() {
    const [ws, user] = await Promise.all([seedWorkspace(), seedUser()])
    const ticket = await seedSdTicket(ws.id)
    const article = await seedSdKbArticle(ws.id, { status: 'PUBLISHED' })
    expectOk(
      await SdKbTicketLinkRepository.link({
        ticketId: ticket.id,
        articleId: article.id,
        linkedById: user.id,
      }),
    )
    return { ws, ticket, article }
  }

  it('conta o reuso uma vez por vínculo, mesmo marcando duas vezes', async () => {
    const { ticket, article } = await linked()

    const first = expectOk(
      await SdKbReviewRepository.markResolved(ticket.id, article.id, true),
    )
    expect(first.changed).toBe(true)
    expect(first.link.resolvedTicket).toBe(true)
    expect(first.link.article.reuseCount).toBe(1)

    const again = expectOk(
      await SdKbReviewRepository.markResolved(ticket.id, article.id, true),
    )
    expect(again.changed).toBe(false)
    expect(again.link.article.reuseCount).toBe(1)
  })

  it('desmarcar devolve o contador e nunca passa de zero', async () => {
    const { ticket, article } = await linked()
    expectOk(
      await SdKbReviewRepository.markResolved(ticket.id, article.id, true),
    )
    const off = expectOk(
      await SdKbReviewRepository.markResolved(ticket.id, article.id, false),
    )
    expect(off.changed).toBe(true)
    expect(off.link.article.reuseCount).toBe(0)

    // Vínculo marcado à mão num artigo com contador já zerado.
    await prisma.sdTicketKbLink.update({
      where: {
        ticketId_articleId: { ticketId: ticket.id, articleId: article.id },
      },
      data: { resolvedTicket: true },
    })
    const forced = expectOk(
      await SdKbReviewRepository.markResolved(ticket.id, article.id, false),
    )
    expect(forced.link.article.reuseCount).toBe(0)
  })

  it('recusa quando o artigo não está vinculado ao chamado', async () => {
    const ws = await seedWorkspace()
    const ticket = await seedSdTicket(ws.id)
    const article = await seedSdKbArticle(ws.id)
    expectErr(
      await SdKbReviewRepository.markResolved(ticket.id, article.id, true),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
  })
})

describe('SdKbReviewRepository — curadoria', () => {
  it('lista os vencidos com quem mantém o artigo', async () => {
    const [ws, author, editor] = await Promise.all([
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    const overdue = await seedSdKbArticle(ws.id, {
      title: 'Vencido',
      status: 'PUBLISHED',
      reviewDueAt: new Date('2026-09-01T00:00:00.000Z'),
      createdById: author.id,
      updatedById: editor.id,
    })
    await Promise.all([
      seedSdKbArticle(ws.id, {
        title: 'No prazo',
        status: 'PUBLISHED',
        reviewDueAt: new Date('2027-01-01T00:00:00.000Z'),
      }),
      seedSdKbArticle(ws.id, {
        title: 'Rascunho vencido',
        reviewDueAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      seedSdKbArticle(ws.id, {
        title: 'Arquivado vencido',
        status: 'PUBLISHED',
        archivedAt: NOW,
        reviewDueAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      seedSdKbArticle(ws.id, { title: 'Sem validade', status: 'PUBLISHED' }),
    ])

    const rows = expectOk(await SdKbReviewRepository.listOverdue(ws.id, NOW))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: overdue.id,
      title: 'Vencido',
      createdById: author.id,
      updatedById: editor.id,
    })
  })

  it('resume a base: totais, mais reusados, vencidos e sem reuso', async () => {
    const ws = await seedWorkspace()
    const [reused] = await Promise.all([
      seedSdKbArticle(ws.id, {
        title: 'Reusado',
        status: 'PUBLISHED',
        reuseCount: 5,
      }),
      seedSdKbArticle(ws.id, {
        title: 'Vencido',
        status: 'PUBLISHED',
        reuseCount: 1,
        reviewDueAt: new Date('2026-08-01T00:00:00.000Z'),
      }),
      seedSdKbArticle(ws.id, { title: 'Nunca usado', status: 'PUBLISHED' }),
      seedSdKbArticle(ws.id, { title: 'Em revisão', status: 'IN_REVIEW' }),
      seedSdKbArticle(ws.id, {
        title: 'Arquivado',
        status: 'PUBLISHED',
        archivedAt: NOW,
        reuseCount: 9,
      }),
    ])

    const stats = expectOk(await SdKbReviewRepository.stats(ws.id, NOW, 5))
    expect(stats).toMatchObject({
      published: 3,
      inReview: 1,
      overdue: 1,
      neverReused: 1,
      resolvedTickets: 6,
    })
    expect(stats.mostReused[0]).toMatchObject({ id: reused.id, reuseCount: 5 })
    expect(stats.overdueArticles.map((a) => a.title)).toEqual(['Vencido'])
    expect(stats.neverReusedArticles.map((a) => a.title)).toEqual([
      'Nunca usado',
    ])
  })
})

describe('SdKbReviewRepository — bordas', () => {
  it('cria revisão sem comentário e resume uma base vazia', async () => {
    const [ws, reviewer, empty] = await Promise.all([
      seedWorkspace(),
      seedUser(),
      seedWorkspace(),
    ])
    const article = await seedSdKbArticle(ws.id)
    const created = expectOk(
      await SdKbReviewRepository.create({
        workspaceId: ws.id,
        articleId: article.id,
        reviewerId: reviewer.id,
      }),
    )
    expect(created.comment).toBeNull()

    const stats = expectOk(await SdKbReviewRepository.stats(empty.id, NOW, 5))
    expect(stats).toMatchObject({ published: 0, resolvedTickets: 0 })
  })

  it('devolve DATABASE_ERROR quando a consulta falha', async () => {
    const ws = await seedWorkspace()
    const article = await seedSdKbArticle(ws.id)

    vi.spyOn(prisma.sdKbReview, 'create').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await SdKbReviewRepository.create({
        workspaceId: ws.id,
        articleId: article.id,
        reviewerId: 'u1',
      }),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.sdKbReview, 'findFirst').mockRejectedValue(
      new Error('boom'),
    )
    expectErr(
      await SdKbReviewRepository.findById('r1', ws.id),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbReviewRepository.findPendingByArticle(article.id),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.sdKbReview, 'findMany').mockRejectedValue(new Error('boom'))
    expectErr(
      await SdKbReviewRepository.listByArticle(article.id),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdKbReviewRepository.listByWorkspace(ws.id, { limit: 10 }),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.sdKbReview, 'update').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await SdKbReviewRepository.decide('r1', {
        status: 'APPROVED',
        comment: null,
        decidedAt: NOW,
      }),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.sdKbReview, 'delete').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(await SdKbReviewRepository.delete('r1'), 'DATABASE_ERROR')

    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdKbReviewRepository.markResolved('t1', article.id, true),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.sdKbArticle, 'findMany').mockRejectedValue(
      new Error('boom'),
    )
    expectErr(
      await SdKbReviewRepository.listOverdue(ws.id, NOW),
      'DATABASE_ERROR',
    )
    expectErr(await SdKbReviewRepository.stats(ws.id, NOW, 5), 'DATABASE_ERROR')
  })
})
