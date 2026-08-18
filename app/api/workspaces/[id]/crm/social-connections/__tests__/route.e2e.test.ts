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

describe('GET /api/workspaces/[id]/crm/social-connections', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/social-connections`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST & DELETE /api/workspaces/[id]/crm/social-connections', () => {
  it('should create and remove a connection', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      { platform: 'INSTAGRAM', externalAccountId: 'acc-1' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.status).toBe('CONNECTED')

    const dup = await postJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      { platform: 'INSTAGRAM', externalAccountId: 'acc-1' },
      user.cookie,
    )
    expect(dup.status).toBe(409)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/social-connections/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })

  it('should allow connecting a second account of the same platform (multi-account)', async () => {
    const { user, workspace } = await authenticatedOwner()

    const first = await postJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      { platform: 'FACEBOOK', externalAccountId: 'page-1' },
      user.cookie,
    )
    expect(first.status).toBe(201)

    const second = await postJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      { platform: 'FACEBOOK', externalAccountId: 'page-2' },
      user.cookie,
    )
    expect(second.status).toBe(201)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      user.cookie,
    )
    const listBody = await list.json()
    const facebookConnections = listBody.data.filter(
      (c: { platform: string }) => c.platform === 'FACEBOOK',
    )
    expect(facebookConnections).toHaveLength(2)
  })
})

describe('PATCH /api/workspaces/[id]/crm/social-connections/[connectionId]/primary', () => {
  it('should switch the primary connection within a platform group', async () => {
    const { user, workspace } = await authenticatedOwner()

    const first = await postJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      { platform: 'FACEBOOK', externalAccountId: 'page-1' },
      user.cookie,
    )
    const firstId = (await first.json()).data.id

    const second = await postJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      { platform: 'FACEBOOK', externalAccountId: 'page-2' },
      user.cookie,
    )
    const secondId = (await second.json()).data.id

    const promoted = await patchJson(
      `/api/workspaces/${workspace.id}/crm/social-connections/${secondId}/primary`,
      {},
      user.cookie,
    )
    expect(promoted.status).toBe(200)
    const promotedBody = await promoted.json()
    expect(promotedBody.data.isPrimary).toBe(true)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/social-connections`,
      user.cookie,
    )
    const listBody = await list.json()
    const primaries = listBody.data.filter(
      (c: { id: string; isPrimary: boolean }) =>
        [firstId, secondId].includes(c.id) && c.isPrimary,
    )
    expect(primaries.map((c: { id: string }) => c.id)).toEqual([secondId])
  })
})
