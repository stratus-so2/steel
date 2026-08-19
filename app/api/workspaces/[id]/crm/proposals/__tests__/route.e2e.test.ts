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
      { name: 'Proposta X', responsibleId: user.id },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.status).toBe('DRAFT')
    expect(createdBody.data.shareToken).toBeTruthy()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${createdBody.data.id}`,
      { name: 'Proposta Y' },
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

describe('CRM proposal send and public access', () => {
  it('should send a proposal and serve it publicly with view tracking', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/proposals`,
        { name: 'Proposta Pública', responsibleId: user.id },
        user.cookie,
      )
    ).json()

    const beforeSend = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(beforeSend.status).toBe(404)

    const sent = await postJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${created.data.id}/send`,
      {},
      user.cookie,
    )
    expect(sent.status).toBe(200)
    const sentBody = await sent.json()
    expect(sentBody.data.status).toBe('SENT')

    const publicRes = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(publicRes.status).toBe(200)
    const publicBody = await publicRes.json()
    expect(publicBody.data.name).toBe('Proposta Pública')
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
