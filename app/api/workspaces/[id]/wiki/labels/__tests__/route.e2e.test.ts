import { describe, expect, it } from 'vitest'
import {
  seedWikiPage,
  withWiki,
} from '@/src/__tests__/factories/wiki-page.factory'
import {
  addMember,
  authenticatedOwner,
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'

async function createLabel(workspaceId: string, cookie: string, name = 'RH') {
  const res = await postJson(
    `/api/workspaces/${workspaceId}/wiki/labels`,
    { name, color: 'green' },
    cookie,
  )
  return { res, body: await res.json() }
}

describe('/api/workspaces/[id]/wiki/labels', () => {
  it('should create, rename, list and delete a label', async () => {
    const { user, workspace } = await authenticatedOwner()

    const { res, body } = await createLabel(workspace.id, user.cookie)
    expect(res.status).toBe(201)
    expect(body.data).toMatchObject({ name: 'RH', color: 'green' })

    const renamed = await patchJson(
      `/api/workspaces/${workspace.id}/wiki/labels/${body.data.id}`,
      { name: 'Pessoas' },
      user.cookie,
    )
    expect(renamed.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/wiki/labels`,
      user.cookie,
    )
    expect(
      (await list.json()).data.map((l: { name: string }) => l.name),
    ).toEqual(['Pessoas'])

    const removed = await deleteJson(
      `/api/workspaces/${workspace.id}/wiki/labels/${body.data.id}`,
      user.cookie,
    )
    expect(removed.status).toBe(200)
  })

  it('should return 409 for a duplicate name', async () => {
    const { user, workspace } = await authenticatedOwner()
    await createLabel(workspace.id, user.cookie)

    const { res } = await createLabel(workspace.id, user.cookie)

    expect(res.status).toBe(409)
  })

  it('should not let a plain member create labels', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const { res } = await createLabel(workspace.id, member.cookie)

    expect(res.status).toBe(403)
  })

  it('should hide a label of another workspace behind a 404', async () => {
    const owner = await authenticatedOwner()
    const other = await authenticatedOwner()
    const { body } = await createLabel(other.workspace.id, other.user.cookie)

    const res = await patchJson(
      `/api/workspaces/${owner.workspace.id}/wiki/labels/${body.data.id}`,
      { name: 'x' },
      owner.user.cookie,
    )

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/workspaces/[id]/wiki/[wikiPageId]/labels', () => {
  it('should let a member label a page and count it on the label', async () => {
    const { user, workspace } = await withWiki(authenticatedOwner())
    const member = await addMember(workspace.id, 'MEMBER')
    const page = await seedWikiPage(workspace.id, user.id)
    const { body } = await createLabel(workspace.id, user.cookie)

    const res = await putJson(
      `/api/workspaces/${workspace.id}/wiki/${page.id}/labels`,
      { labelIds: [body.data.id] },
      member.cookie,
    )

    expect(res.status).toBe(200)
    expect((await res.json()).data.labelIds).toEqual([body.data.id])
    const list = await getJson(
      `/api/workspaces/${workspace.id}/wiki/labels`,
      user.cookie,
    )
    expect((await list.json()).data[0].pageCount).toBe(1)
  })

  it('should reject a label from another workspace', async () => {
    const { user, workspace } = await withWiki(authenticatedOwner())
    const other = await authenticatedOwner()
    const page = await seedWikiPage(workspace.id, user.id)
    const { body } = await createLabel(other.workspace.id, other.user.cookie)

    const res = await putJson(
      `/api/workspaces/${workspace.id}/wiki/${page.id}/labels`,
      { labelIds: [body.data.id] },
      user.cookie,
    )

    expect(res.status).toBe(404)
  })
})
