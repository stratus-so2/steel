import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  deleteJson,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'

async function seedTicket(workspaceId: string, requesterId?: string) {
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
      number: 1,
      type: 'INCIDENT',
      title: 'VPN não conecta',
      phaseId: phase.id,
      requesterId,
    },
  })
}

function links(workspaceId: string, ticketId: string, query = '') {
  return `/api/workspaces/${workspaceId}/servicedesk/tickets/${ticketId}/kb-links${query}`
}

describe('/api/workspaces/[id]/servicedesk/tickets/[ticketId]/kb-links', () => {
  it('links, lists, suggests and unlinks articles for agents', async () => {
    const { user, workspace } = await authenticatedOwner()
    const ticket = await seedTicket(workspace.id)
    const article = await prisma.sdKbArticle.create({
      data: {
        workspaceId: workspace.id,
        title: 'VPN corporativa',
        content: [],
        status: 'PUBLISHED',
      },
    })

    const linked = await postJson(
      links(workspace.id, ticket.id),
      { articleId: article.id },
      user.cookie,
    )
    expect(linked.status).toBe(201)
    expect((await linked.json()).data.article.id).toBe(article.id)

    const list = await getJson(links(workspace.id, ticket.id), user.cookie)
    expect((await list.json()).data).toHaveLength(1)

    const suggest = await getJson(
      `/api/workspaces/${workspace.id}/servicedesk/knowledge/suggest?ticketId=${ticket.id}`,
      user.cookie,
    )
    expect(suggest.status).toBe(200)
    expect(
      (await suggest.json()).data.map((a: { id: string }) => a.id),
    ).toEqual([article.id])

    const unlinked = await deleteJson(
      links(workspace.id, ticket.id, `?articleId=${article.id}`),
      user.cookie,
    )
    expect(unlinked.status).toBe(200)
    const after = await getJson(links(workspace.id, ticket.id), user.cookie)
    expect((await after.json()).data).toEqual([])
  })

  it('lets the requester read portal links of their ticket only', async () => {
    const { user, workspace } = await authenticatedOwner()
    const requester = await addMember(workspace.id, 'MEMBER')
    const other = await addMember(workspace.id, 'MEMBER')
    const ticket = await seedTicket(workspace.id, requester.id)
    const article = await prisma.sdKbArticle.create({
      data: {
        workspaceId: workspace.id,
        title: 'Portal',
        content: [],
        status: 'PUBLISHED',
        visibility: 'PORTAL',
      },
    })
    await postJson(
      links(workspace.id, ticket.id),
      { articleId: article.id },
      user.cookie,
    )

    const mine = await getJson(links(workspace.id, ticket.id), requester.cookie)
    expect((await mine.json()).data).toHaveLength(1)
    const theirs = await getJson(links(workspace.id, ticket.id), other.cookie)
    expect(theirs.status).toBe(403)
    const write = await postJson(
      links(workspace.id, ticket.id),
      { articleId: article.id },
      requester.cookie,
    )
    expect(write.status).toBe(403)
  })

  it('returns 403 for strangers and 404 for unknown tickets', async () => {
    const { user, workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    expect(
      (await getJson(links(workspace.id, 'missing'), stranger.cookie)).status,
    ).toBe(403)
    expect(
      (await getJson(links(workspace.id, 'missing'), user.cookie)).status,
    ).toBe(404)
  })
})
