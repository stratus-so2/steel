import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  deleteJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('CRM lead routing rules', () => {
  it('should create, update and delete a routing rule', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/lead-routing-rules`,
      {
        field: 'source',
        operator: 'equals',
        value: 'ads',
        ownerId: user.id,
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/lead-routing-rules/${createdBody.data.id}`,
      { active: false },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.active).toBe(false)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/lead-routing-rules/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
