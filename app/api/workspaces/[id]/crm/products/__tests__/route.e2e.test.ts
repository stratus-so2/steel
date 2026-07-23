import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('GET /api/workspaces/[id]/crm/products', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces/some-id/crm/products`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/products`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/products', () => {
  it('should create a product for a workspace member', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/products`,
      { name: 'Plano Pro', unitPrice: 199.9 },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Plano Pro')
    expect(body.data.unitPrice).toBe(199.9)
  })

  it('should return 409 on duplicate sku', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/products`,
      { name: 'Plano Pro', sku: 'PRO-1' },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/products`,
      { name: 'Plano Pro 2', sku: 'PRO-1' },
      user.cookie,
    )
    expect(res.status).toBe(409)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/products/[productId]', () => {
  it('should update and soft delete a product', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/products`,
        { name: 'Plano Pro' },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/products/${created.data.id}`,
      { active: false },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.active).toBe(false)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/products/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/products`,
      user.cookie,
    )
    const body = await list.json()
    expect(body.data).toEqual([])
  })
})
