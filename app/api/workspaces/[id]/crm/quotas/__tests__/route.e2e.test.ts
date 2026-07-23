import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('CRM quotas', () => {
  it('should create, update and delete a quota for a privileged member', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/quotas`,
      {
        ownerId: user.id,
        period: 'MONTH',
        periodKey: '2026-08',
        targetAmount: 50000,
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/quotas/${createdBody.data.id}`,
      { targetAmount: 75000 },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.targetAmount).toBe(75000)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/quotas/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })

  it('should return 403 for a plain member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/quotas`,
      member.cookie,
    )
    expect(res.status).toBe(403)
  })
})
