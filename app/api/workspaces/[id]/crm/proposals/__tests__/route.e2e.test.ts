import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('POST, PATCH & DELETE /api/workspaces/[id]/crm/proposals', () => {
  it('should create, update and delete a proposal', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/proposals`,
      { title: 'Proposta X' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.status).toBe('DRAFT')
    expect(createdBody.data.shareToken).toBeTruthy()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${createdBody.data.id}`,
      { title: 'Proposta Y' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('CRM proposal publish and public access', () => {
  it('should publish a proposal and serve it publicly with view tracking', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/proposals`,
        { title: 'Proposta Pública', content: '<p>Olá</p>' },
        user.cookie,
      )
    ).json()

    const beforePublish = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(beforePublish.status).toBe(404)

    const published = await postJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${created.data.id}/publish`,
      {},
      user.cookie,
    )
    expect(published.status).toBe(200)
    const publishedBody = await published.json()
    expect(publishedBody.data.status).toBe('PUBLISHED')

    const publicRes = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(publicRes.status).toBe(200)
    const publicBody = await publicRes.json()
    expect(publicBody.data.title).toBe('Proposta Pública')
    expect(publicBody.data).not.toHaveProperty('shareToken')

    const viewRes = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}/view`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({ viewId: 'view-1', scrolledPct: 50 }),
      },
    )
    expect(viewRes.status).toBe(200)
  })
})
