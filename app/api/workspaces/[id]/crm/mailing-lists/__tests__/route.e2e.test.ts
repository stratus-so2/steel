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

describe('GET /api/workspaces/[id]/crm/mailing-lists', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/mailing-lists`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/mailing-lists', () => {
  it('should create a mailing list', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists`,
      { name: 'Clientes VIP' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Clientes VIP')
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/mailing-lists/[listId]', () => {
  it('should update and delete a mailing list', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/mailing-lists`,
        { name: 'Clientes VIP' },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists/${created.data.id}`,
      { name: 'Clientes VIP 2026' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.name).toBe('Clientes VIP 2026')

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('mailing list members', () => {
  it('should add, list and remove a member', async () => {
    const { user, workspace } = await authenticatedOwner()
    const list = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/mailing-lists`,
        { name: 'Clientes VIP' },
        user.cookie,
      )
    ).json()

    const added = await postJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists/${list.data.id}/members`,
      { email: 'lead@example.com', name: 'Lead Teste' },
      user.cookie,
    )
    expect(added.status).toBe(201)
    const addedBody = await added.json()
    expect(addedBody.data.email).toBe('lead@example.com')

    const listed = await getJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists/${list.data.id}/members`,
      user.cookie,
    )
    expect(listed.status).toBe(200)
    const listedBody = await listed.json()
    expect(listedBody.data).toHaveLength(1)

    const removed = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists/${list.data.id}/members/${addedBody.data.id}`,
      user.cookie,
    )
    expect(removed.status).toBe(200)

    const afterRemoval = await getJson(
      `/api/workspaces/${workspace.id}/crm/mailing-lists/${list.data.id}/members`,
      user.cookie,
    )
    const afterRemovalBody = await afterRemoval.json()
    expect(afterRemovalBody.data).toHaveLength(0)
  })
})
