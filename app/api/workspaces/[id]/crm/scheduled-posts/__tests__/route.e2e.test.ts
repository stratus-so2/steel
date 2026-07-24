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

describe('GET /api/workspaces/[id]/crm/scheduled-posts', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/scheduled-posts`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/scheduled-posts`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST, PATCH & DELETE /api/workspaces/[id]/crm/scheduled-posts', () => {
  it('should create with targets, update and delete', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/scheduled-posts`,
      { content: 'Olá', platforms: ['INSTAGRAM', 'FACEBOOK'] },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.targets).toHaveLength(2)

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/scheduled-posts/${createdBody.data.id}`,
      { content: 'Olá mundo' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/scheduled-posts/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('POST /api/workspaces/[id]/crm/scheduled-posts/[postId]/publish', () => {
  it('should mark the post FAILED since no platform is really connected', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/scheduled-posts`,
        { content: 'Olá', platforms: ['INSTAGRAM'] },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/scheduled-posts/${created.data.id}/publish`,
      {},
      user.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('FAILED')
    expect(body.data.targets[0].status).toBe('FAILED')
    expect(body.data.targets[0].error).toContain('exige mídia')

    const again = await postJson(
      `/api/workspaces/${workspace.id}/crm/scheduled-posts/${created.data.id}/publish`,
      {},
      user.cookie,
    )
    expect(again.status).toBe(200)
  })
})
