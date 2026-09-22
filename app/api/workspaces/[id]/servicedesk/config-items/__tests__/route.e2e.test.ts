import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

const api = (workspaceId: string, path: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/${path}`

describe('/api/workspaces/[id]/servicedesk/config-item-types', () => {
  it('lets admins manage types and refuses members', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      api(workspace.id, 'config-item-types'),
      {
        name: 'Servidor',
        attributeSchema: [
          { key: 'hostname', label: 'Hostname', type: 'text', required: true },
        ],
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const type = (await created.json()).data

    const duplicate = await postJson(
      api(workspace.id, 'config-item-types'),
      { name: 'servidor' },
      user.cookie,
    )
    expect((await duplicate.json()).error.code).toBe('SD_CONFIG_CONFLICT')

    const member = await addMember(workspace.id, 'MEMBER')
    const denied = await postJson(
      api(workspace.id, 'config-item-types'),
      { name: 'Notebook' },
      member.cookie,
    )
    expect(denied.status).toBe(403)

    const updated = await patchJson(
      api(workspace.id, `config-item-types/${type.id}`),
      { color: '#16a34a' },
      user.cookie,
    )
    expect((await updated.json()).data.color).toBe('#16a34a')

    const listed = await getJson(
      api(workspace.id, 'config-item-types'),
      user.cookie,
    )
    expect(
      (await listed.json()).data.map((t: { id: string }) => t.id),
    ).toContain(type.id)

    const deleted = await deleteJson(
      api(workspace.id, `config-item-types/${type.id}`),
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('/api/workspaces/[id]/servicedesk/config-items', () => {
  it('returns 403 for a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await getJson(
      api(workspace.id, 'config-items'),
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('creates a hierarchy with typed attributes, prevents cycles and deletes', async () => {
    const { user, workspace } = await authenticatedOwner()
    const type = (
      await (
        await postJson(
          api(workspace.id, 'config-item-types'),
          {
            name: 'Servidor',
            attributeSchema: [
              {
                key: 'hostname',
                label: 'Hostname',
                type: 'text',
                required: true,
              },
            ],
          },
          user.cookie,
        )
      ).json()
    ).data

    const invalid = await postJson(
      api(workspace.id, 'config-items'),
      { name: 'Sem host', typeId: type.id, attributes: {} },
      user.cookie,
    )
    expect(invalid.status).toBe(422)

    const rack = (
      await (
        await postJson(
          api(workspace.id, 'config-items'),
          { name: 'Rack A', code: 'RCK-1' },
          user.cookie,
        )
      ).json()
    ).data

    const created = await postJson(
      api(workspace.id, 'config-items'),
      {
        name: 'SRV-01',
        typeId: type.id,
        parentId: rack.id,
        attributes: { hostname: 'srv-01' },
        warrantyUntil: new Date(Date.now() + 5 * 86400000)
          .toISOString()
          .slice(0, 10),
        ownerId: user.id,
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const server = (await created.json()).data
    expect(server).toMatchObject({
      parent: { id: rack.id, name: 'Rack A' },
      type: { id: type.id, name: 'Servidor' },
      attributes: { hostname: 'srv-01' },
      owner: { id: user.id },
    })

    const cycle = await patchJson(
      api(workspace.id, `config-items/${rack.id}`),
      { parentId: server.id },
      user.cookie,
    )
    expect(cycle.status).toBe(422)
    expect((await cycle.json()).error.code).toBe('SD_CONFIG_ITEM_CYCLE')

    const expiring = await getJson(
      api(workspace.id, 'config-items?warrantyExpiringInDays=30'),
      user.cookie,
    )
    expect(
      (await expiring.json()).data.items.map((i: { id: string }) => i.id),
    ).toEqual([server.id])

    const detail = await getJson(
      api(workspace.id, `config-items/${rack.id}`),
      user.cookie,
    )
    const rackDetail = (await detail.json()).data
    expect(rackDetail.children).toEqual([
      expect.objectContaining({ id: server.id, typeName: 'Servidor' }),
    ])
    expect(rackDetail.ancestors).toEqual([])

    const options = await getJson(
      api(workspace.id, 'config-items/options?q=srv'),
      user.cookie,
    )
    expect((await options.json()).data[0]).toMatchObject({
      id: server.id,
      label: 'SRV-01',
    })

    const deleted = await deleteJson(
      api(workspace.id, `config-items/${rack.id}`),
      user.cookie,
    )
    expect(deleted.status).toBe(200)
    const orphan = await getJson(
      api(workspace.id, `config-items/${server.id}`),
      user.cookie,
    )
    expect((await orphan.json()).data.parentId).toBeNull()
  })
})
