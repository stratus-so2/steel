import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('GET /api/workspaces/[id]/crm/ai/conversations', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/ai/conversations`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/ai/conversations`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST & DELETE /api/workspaces/[id]/crm/ai/conversations', () => {
  it('should create and delete a conversation', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/ai/conversations`,
      { title: 'Dúvida sobre lead' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/ai/conversations/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })

  it("should not let another workspace member access someone else's conversation", async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/ai/conversations`,
        {},
        user.cookie,
      )
    ).json()

    const other = await createAuthenticatedUser()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/ai/conversations/${created.data.id}`,
      other.cookie,
    )
    expect(res.status).toBe(403)
  })
})
