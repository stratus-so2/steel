import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'

describe('/api/workspaces/[id]/notifications', () => {
  it('should list the user own notifications and mark them as read', async () => {
    const { user, workspace } = await authenticatedOwner()
    const other = await addMember(workspace.id, 'MEMBER')
    await prisma.notification.createMany({
      data: [
        {
          workspaceId: workspace.id,
          userId: user.id,
          kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
          title: 'Sentimento negativo: Maria',
          body: 'Média -0,50',
        },
        {
          workspaceId: workspace.id,
          userId: other.id,
          kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
          title: 'De outro usuário',
          body: 'x',
        },
      ],
    })
    const base = `/api/workspaces/${workspace.id}/notifications`

    const list = await getJson(base, user.cookie)
    expect(list.status).toBe(200)
    const body = await list.json()
    expect(body.data.unreadCount).toBe(1)
    expect(body.data.items).toHaveLength(1)
    expect(body.data.items[0].title).toBe('Sentimento negativo: Maria')
    expect(body.data.items[0].module).toBe('COMMUNICATION')
    expect(body.data.items[0].moduleLabel).toBe('Comunicação')
    expect(body.data.counts).toEqual({ all: 1, unread: 1, archived: 0 })
    expect(body.data.nextCursor).toBeNull()

    const read = await postJson(`${base}/read`, {}, user.cookie)
    expect(read.status).toBe(200)
    expect((await read.json()).data.updated).toBe(1)

    const after = await getJson(base, user.cookie)
    expect((await after.json()).data.unreadCount).toBe(0)
  })

  it('should forbid non-members', async () => {
    const { workspace } = await authenticatedOwner()
    const { user: outsider } = await authenticatedOwner()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/notifications`,
      outsider.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should filter by folder, module, kind and search, and page by cursor', async () => {
    const { user, workspace } = await authenticatedOwner()
    const at = (offset: number) =>
      new Date(new Date('2026-09-18T12:00:00Z').getTime() + offset)
    await prisma.notification.createMany({
      data: [
        {
          workspaceId: workspace.id,
          userId: user.id,
          kind: 'SD_TICKET_ASSIGNED',
          title: 'Chamado INC-000123 atribuído',
          body: 'Rede sem acesso no 3º andar',
          createdAt: at(0),
        },
        {
          workspaceId: workspace.id,
          userId: user.id,
          kind: 'SD_SLA_BREACHED',
          title: 'SLA violado: INC-000124',
          body: 'O prazo estourou',
          createdAt: at(1000),
        },
        {
          workspaceId: workspace.id,
          userId: user.id,
          kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
          title: 'Sentimento negativo: Maria',
          body: 'Média -0,50',
          createdAt: at(2000),
        },
      ],
    })
    const base = `/api/workspaces/${workspace.id}/notifications`

    const byModule = await getJson(`${base}?module=SERVICE_DESK`, user.cookie)
    const moduleBody = await byModule.json()
    expect(moduleBody.data.items.map((n: { kind: string }) => n.kind)).toEqual([
      'SD_SLA_BREACHED',
      'SD_TICKET_ASSIGNED',
    ])

    const byKind = await getJson(`${base}?kind=SD_SLA_BREACHED`, user.cookie)
    expect((await byKind.json()).data.items).toHaveLength(1)

    const bySearch = await getJson(`${base}?search=ANDAR`, user.cookie)
    expect((await bySearch.json()).data.items[0].title).toBe(
      'Chamado INC-000123 atribuído',
    )

    const firstPage = await getJson(`${base}?limit=2`, user.cookie)
    const first = (await firstPage.json()).data
    expect(first.items).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()

    const secondPage = await getJson(
      `${base}?limit=2&cursor=${first.nextCursor}`,
      user.cookie,
    )
    const second = (await secondPage.json()).data
    expect(second.items).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
  })

  it('should reject an invalid folder', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/notifications?folder=spam`,
      user.cookie,
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/workspaces/[id]/notifications/actions', () => {
  async function seed() {
    const { user, workspace } = await authenticatedOwner()
    const other = await addMember(workspace.id, 'MEMBER')
    await prisma.notification.createMany({
      data: [
        {
          workspaceId: workspace.id,
          userId: user.id,
          kind: 'SD_SLA_BREACHED',
          title: 'SLA violado: INC-000124',
          body: 'O prazo estourou',
        },
        {
          workspaceId: workspace.id,
          userId: other.id,
          kind: 'SD_SLA_BREACHED',
          title: 'Do colega',
          body: 'x',
        },
      ],
    })
    const mine = await prisma.notification.findFirstOrThrow({
      where: { userId: user.id },
    })
    const theirs = await prisma.notification.findFirstOrThrow({
      where: { userId: other.id },
    })
    return { user, workspace, mine, theirs }
  }

  it('should archive, unarchive, delete and restore the own notifications', async () => {
    const { user, workspace, mine } = await seed()
    const base = `/api/workspaces/${workspace.id}/notifications`

    const archive = await postJson(
      `${base}/actions`,
      { action: 'archive', ids: [mine.id] },
      user.cookie,
    )
    expect(archive.status).toBe(200)
    expect((await archive.json()).data.updated).toBe(1)

    const all = await getJson(base, user.cookie)
    const allBody = await all.json()
    expect(allBody.data.items).toHaveLength(0)
    expect(allBody.data.counts).toEqual({ all: 0, unread: 0, archived: 1 })

    const archived = await getJson(`${base}?folder=archived`, user.cookie)
    expect((await archived.json()).data.items[0].archived).toBe(true)

    await postJson(
      `${base}/actions`,
      { action: 'unarchive', ids: [mine.id] },
      user.cookie,
    )
    const unread = await getJson(`${base}?folder=unread`, user.cookie)
    expect((await unread.json()).data.items).toHaveLength(1)

    await postJson(
      `${base}/actions`,
      { action: 'delete', ids: [mine.id] },
      user.cookie,
    )
    const afterDelete = await getJson(base, user.cookie)
    expect((await afterDelete.json()).data.counts).toEqual({
      all: 0,
      unread: 0,
      archived: 0,
    })

    const restore = await postJson(
      `${base}/actions`,
      { action: 'restore', ids: [mine.id] },
      user.cookie,
    )
    expect((await restore.json()).data.updated).toBe(1)
    const afterRestore = await getJson(base, user.cookie)
    expect((await afterRestore.json()).data.items).toHaveLength(1)
  })

  it('should toggle read and unread', async () => {
    const { user, workspace, mine } = await seed()
    const base = `/api/workspaces/${workspace.id}/notifications`

    await postJson(
      `${base}/actions`,
      { action: 'read', ids: [mine.id] },
      user.cookie,
    )
    expect(
      (await (await getJson(base, user.cookie)).json()).data.unreadCount,
    ).toBe(0)

    await postJson(
      `${base}/actions`,
      { action: 'unread', ids: [mine.id] },
      user.cookie,
    )
    expect(
      (await (await getJson(base, user.cookie)).json()).data.unreadCount,
    ).toBe(1)
  })

  it('should ignore ids that belong to another member', async () => {
    const { user, workspace, theirs } = await seed()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/notifications/actions`,
      { action: 'delete', ids: [theirs.id] },
      user.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data.updated).toBe(0)
    expect(
      await prisma.notification.count({
        where: { id: theirs.id, deletedAt: null },
      }),
    ).toBe(1)
  })

  it('should validate the body and forbid non-members', async () => {
    const { user, workspace } = await seed()
    const { user: outsider } = await authenticatedOwner()
    const url = `/api/workspaces/${workspace.id}/notifications/actions`

    const invalid = await postJson(
      url,
      { action: 'spam', ids: [] },
      user.cookie,
    )
    expect(invalid.status).toBe(400)

    const forbidden = await postJson(
      url,
      { action: 'read', ids: ['n1'] },
      outsider.cookie,
    )
    expect(forbidden.status).toBe(403)
  })
})

describe('GET /api/workspaces/[id]/notifications/events', () => {
  it('should open the SSE stream for a member and forbid an outsider', async () => {
    const { user, workspace } = await authenticatedOwner()
    const { user: outsider } = await authenticatedOwner()
    const url = `/api/workspaces/${workspace.id}/notifications/events`

    const forbidden = await getJson(url, outsider.cookie)
    expect(forbidden.status).toBe(403)

    const stream = await getJson(url, user.cookie)
    expect(stream.status).toBe(200)
    expect(stream.headers.get('content-type')).toContain('text/event-stream')
    await stream.body?.cancel()
  })
})
