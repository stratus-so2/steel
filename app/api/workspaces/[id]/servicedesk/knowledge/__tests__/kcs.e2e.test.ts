import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

/**
 * KCS: artigo a partir do chamado, ciclo de revisão com validade, marcador de
 * reuso e curadoria da base.
 */

function kb(workspaceId: string, path = '') {
  return `/api/workspaces/${workspaceId}/servicedesk/knowledge${path}`
}

/** Agente de verdade: membro de um departamento ativo do módulo. */
async function agentMember(workspaceId: string) {
  const user = await addMember(workspaceId, 'MEMBER')
  const department = await prisma.sdDepartment.create({
    data: { workspaceId, name: `Suporte ${user.id.slice(0, 6)}` },
  })
  await prisma.sdDepartmentMember.create({
    data: { departmentId: department.id, userId: user.id },
  })
  return user
}

async function ticketFor(workspaceId: string, title = 'VPN não conecta') {
  const phase = await prisma.sdPhase.create({
    data: {
      workspaceId,
      ticketType: 'INCIDENT',
      name: 'Novo',
      category: 'NEW',
      isInitial: true,
    },
  })
  return prisma.sdTicket.create({
    data: {
      workspaceId,
      number: Math.floor(Math.random() * 1_000_000),
      type: 'INCIDENT',
      title,
      description: '<p>Erro 809 ao conectar.</p>',
      phaseId: phase.id,
    },
  })
}

describe('KCS routes — guards', () => {
  it('returns 401 without a session', async () => {
    for (const path of ['/reviews', '/stats', '/review-settings']) {
      const res = await fetch(`${BASE_URL}${kb('some-id', path)}`, {
        headers: defaultHeaders,
      })
      expect(res.status).toBe(401)
    }
  })

  it('refuses a requester (member without department)', async () => {
    const { workspace } = await authenticatedOwner()
    const requester = await addMember(workspace.id, 'MEMBER')
    expect(
      (await getJson(kb(workspace.id, '/reviews'), requester.cookie)).status,
    ).toBe(403)
    expect(
      (await getJson(kb(workspace.id, '/stats'), requester.cookie)).status,
    ).toBe(403)
  })

  it('validates the payload', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await postJson(
      kb(workspace.id),
      { title: 'VPN' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const article = (await created.json()).data

    const noReviewer = await postJson(
      kb(workspace.id, `/${article.id}/reviews`),
      {},
      user.cookie,
    )
    expect(noReviewer.status).toBe(422)

    const badInterval = await patchJson(
      kb(workspace.id, `/${article.id}/review-interval`),
      { reviewIntervalDays: 0 },
      user.cookie,
    )
    expect(badInterval.status).toBe(422)
  })
})

describe('KCS — artigo a partir do chamado e ciclo de revisão', () => {
  it('cria o rascunho do chamado, revisa, publica e conta o reuso', async () => {
    const { user, workspace } = await authenticatedOwner()
    const ws = workspace.id
    const reviewer = await agentMember(ws)
    const ticket = await ticketFor(ws)

    // 1. sugestões antes de abrir o chamado (nada publicado ainda)
    const suggest = await postJson(
      kb(ws, '/suggest/draft'),
      { title: 'VPN não conecta', description: 'erro 809' },
      user.cookie,
    )
    expect(suggest.status).toBe(200)
    expect((await suggest.json()).data).toEqual([])

    // 2. "criar artigo a partir deste chamado" (sem IA no ambiente de teste)
    const draft = await postJson(
      kb(ws, '/draft'),
      { ticketId: ticket.id, useAi: false },
      user.cookie,
    )
    expect(draft.status).toBe(201)
    const drafted = (await draft.json()).data
    expect(drafted).toMatchObject({ aiUsed: false })
    expect(drafted.article).toMatchObject({
      status: 'DRAFT',
      sourceTicketId: ticket.id,
      reuseCount: 0,
    })
    const articleId = drafted.article.id as string
    const sections = (
      drafted.article.content as { children: { text: string }[] }[]
    )
      .map((block) => block.children[0]?.text)
      .filter(Boolean)
    expect(sections).toContain('Problema')
    expect(sections).toContain('Validação')

    // o vínculo com o chamado já nasce junto
    const links = await getJson(
      `/api/workspaces/${ws}/servicedesk/tickets/${ticket.id}/kb-links`,
      user.cookie,
    )
    expect(links.status).toBe(200)
    expect((await links.json()).data).toHaveLength(1)

    // 3. estado inicial da revisão
    const initial = await getJson(kb(ws, `/${articleId}/reviews`), user.cookie)
    expect(initial.status).toBe(200)
    expect((await initial.json()).data).toMatchObject({
      status: 'DRAFT',
      overdue: false,
      pending: null,
      effectiveIntervalDays: 180,
    })

    // 4. validade própria do artigo
    const interval = await patchJson(
      kb(ws, `/${articleId}/review-interval`),
      { reviewIntervalDays: 30 },
      user.cookie,
    )
    expect(interval.status).toBe(200)
    expect((await interval.json()).data).toMatchObject({
      reviewIntervalDays: 30,
      effectiveIntervalDays: 30,
    })

    // 5. pedir revisão (o revisor precisa ser agente)
    const stranger = await addMember(ws, 'MEMBER')
    const notAgent = await postJson(
      kb(ws, `/${articleId}/reviews`),
      { reviewerId: stranger.id },
      user.cookie,
    )
    expect(notAgent.status).toBe(403)

    const requested = await postJson(
      kb(ws, `/${articleId}/reviews`),
      { reviewerId: reviewer.id, comment: 'confere o passo 3' },
      user.cookie,
    )
    expect(requested.status).toBe(201)
    const state = (await requested.json()).data
    expect(state).toMatchObject({ status: 'IN_REVIEW' })
    expect(state.pending).toMatchObject({
      status: 'PENDING',
      reviewerId: reviewer.id,
      comment: 'confere o passo 3',
    })
    const reviewId = state.pending.id as string

    // duas revisões pendentes do mesmo artigo não existem
    const again = await postJson(
      kb(ws, `/${articleId}/reviews`),
      { reviewerId: reviewer.id },
      user.cookie,
    )
    expect(again.status).toBe(409)

    // 6. a fila do revisor mostra a pendência
    const mine = await getJson(
      kb(ws, '/reviews?mine=true&status=PENDING'),
      reviewer.cookie,
    )
    expect(mine.status).toBe(200)
    expect((await mine.json()).data[0]).toMatchObject({ id: reviewId })

    // 7. o revisor pede mudanças (comentário obrigatório)
    const noComment = await patchJson(
      kb(ws, `/reviews/${reviewId}`),
      { decision: 'REQUEST_CHANGES' },
      reviewer.cookie,
    )
    expect(noComment.status).toBe(422)

    const changes = await patchJson(
      kb(ws, `/reviews/${reviewId}`),
      { decision: 'REQUEST_CHANGES', comment: 'falta a validação' },
      reviewer.cookie,
    )
    expect(changes.status).toBe(200)
    const afterChanges = (await changes.json()).data
    expect(afterChanges).toMatchObject({ status: 'DRAFT', pending: null })
    expect(afterChanges.history[0]).toMatchObject({
      status: 'CHANGES_REQUESTED',
      comment: 'falta a validação',
    })

    // a mesma revisão não pode ser decidida duas vezes
    const closed = await patchJson(
      kb(ws, `/reviews/${reviewId}`),
      { decision: 'APPROVE' },
      reviewer.cookie,
    )
    expect(closed.status).toBe(409)

    // 8. nova rodada: aprovar publica e agenda a próxima revisão
    const second = await postJson(
      kb(ws, `/${articleId}/reviews`),
      { reviewerId: reviewer.id },
      user.cookie,
    )
    const secondId = (await second.json()).data.pending.id as string

    const outsider = await agentMember(ws)
    const notReviewer = await patchJson(
      kb(ws, `/reviews/${secondId}`),
      { decision: 'APPROVE' },
      outsider.cookie,
    )
    expect(notReviewer.status).toBe(403)

    const approved = await patchJson(
      kb(ws, `/reviews/${secondId}`),
      { decision: 'APPROVE' },
      reviewer.cookie,
    )
    expect(approved.status).toBe(200)
    const published = (await approved.json()).data
    expect(published).toMatchObject({ status: 'PUBLISHED', overdue: false })
    expect(published.lastReviewedAt).not.toBeNull()
    expect(published.reviewDueAt).not.toBeNull()

    // 9. marcador de reuso: idempotente e nunca negativo
    const resolved = await patchJson(
      kb(ws, `/${articleId}/resolved`),
      { ticketId: ticket.id, resolved: true },
      user.cookie,
    )
    expect(resolved.status).toBe(200)
    expect((await resolved.json()).data).toMatchObject({
      resolvedTicket: true,
      article: { reuseCount: 1 },
    })

    const twice = await patchJson(
      kb(ws, `/${articleId}/resolved`),
      { ticketId: ticket.id, resolved: true },
      user.cookie,
    )
    expect((await twice.json()).data.article.reuseCount).toBe(1)

    const off = await patchJson(
      kb(ws, `/${articleId}/resolved`),
      { ticketId: ticket.id, resolved: false },
      user.cookie,
    )
    expect((await off.json()).data).toMatchObject({
      resolvedTicket: false,
      article: { reuseCount: 0 },
    })

    // 10. curadoria: o artigo publicado aparece em "sem reuso"
    const stats = await getJson(kb(ws, '/stats'), user.cookie)
    expect(stats.status).toBe(200)
    const numbers = (await stats.json()).data
    expect(numbers.totals).toMatchObject({ published: 1, inReview: 0 })
    expect(numbers.neverReused.map((a: { id: string }) => a.id)).toContain(
      articleId,
    )

    // 11. agora o artigo publicado aparece nas sugestões da abertura
    const nowSuggests = await postJson(
      kb(ws, '/suggest/draft'),
      { title: 'VPN não conecta' },
      user.cookie,
    )
    expect(
      (await nowSuggests.json()).data.map((a: { id: string }) => a.id),
    ).toContain(articleId)
  })

  it('cancela a revisão pedida e devolve o rascunho ao autor', async () => {
    const { user, workspace } = await authenticatedOwner()
    const ws = workspace.id
    const reviewer = await agentMember(ws)
    const article = (
      await (
        await postJson(kb(ws), { title: 'Impressora' }, user.cookie)
      ).json()
    ).data

    const requested = await postJson(
      kb(ws, `/${article.id}/reviews`),
      { reviewerId: reviewer.id },
      user.cookie,
    )
    const reviewId = (await requested.json()).data.pending.id as string

    const canceled = await deleteJson(
      kb(ws, `/reviews/${reviewId}`),
      user.cookie,
    )
    expect(canceled.status).toBe(200)
    expect((await canceled.json()).data).toMatchObject({
      status: 'DRAFT',
      pending: null,
      history: [],
    })
  })
})

describe('KCS — validade padrão do workspace', () => {
  it('só admin do módulo altera o padrão', async () => {
    const { user, workspace } = await authenticatedOwner()
    const ws = workspace.id
    const agent = await agentMember(ws)

    const read = await getJson(kb(ws, '/review-settings'), agent.cookie)
    expect(read.status).toBe(200)
    expect((await read.json()).data).toEqual({ defaultIntervalDays: 180 })

    const denied = await patchJson(
      kb(ws, '/review-settings'),
      { defaultIntervalDays: 90 },
      agent.cookie,
    )
    expect(denied.status).toBe(403)

    const saved = await patchJson(
      kb(ws, '/review-settings'),
      { defaultIntervalDays: 90 },
      user.cookie,
    )
    expect(saved.status).toBe(200)
    expect((await saved.json()).data).toEqual({ defaultIntervalDays: 90 })

    const settings = await getJson(
      `/api/workspaces/${ws}/servicedesk/settings`,
      user.cookie,
    )
    expect((await settings.json()).data.kbReviewIntervalDays).toBe(90)
  })
})
