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
})
