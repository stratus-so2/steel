import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  deleteJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('POST, PATCH & DELETE /api/workspaces/[id]/crm/notes', () => {
  it('should create, update and delete a note', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/notes`,
      { body: 'Notas da call' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/notes/${createdBody.data.id}`,
      { body: 'Notas atualizadas' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.body).toBe('Notas atualizadas')

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/notes/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
