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

describe('GET /api/workspaces/[id]/crm/email-accounts', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/email-accounts`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/email-accounts`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST & DELETE /api/workspaces/[id]/crm/email-accounts', () => {
  it('should create and remove an account, rejecting a duplicate provider', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-accounts`,
      { provider: 'GMAIL', email: 'user@example.com' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.lastSyncedAt).toBeNull()

    const dup = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-accounts`,
      { provider: 'GMAIL', email: 'user2@example.com' },
      user.cookie,
    )
    expect(dup.status).toBe(409)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/email-accounts/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
