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

describe('GET /api/workspaces/[id]/crm/tasks', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces/some-id/crm/tasks`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/tasks`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST, PATCH & DELETE /api/workspaces/[id]/crm/tasks', () => {
  it('should create, update and delete a task', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/tasks`,
      { title: 'Ligar pro cliente' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.status).toBe('TODO')

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/tasks/${createdBody.data.id}`,
      { status: 'DONE' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.status).toBe('DONE')

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/tasks/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
