import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  deleteJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('CRM lead scoring rules', () => {
  it('should create, update and delete a scoring rule', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/lead-scoring-rules`,
      { field: 'company', operator: 'is_not_empty', points: 5 },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/lead-scoring-rules/${createdBody.data.id}`,
      { points: 25 },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.points).toBe(25)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/lead-scoring-rules/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
