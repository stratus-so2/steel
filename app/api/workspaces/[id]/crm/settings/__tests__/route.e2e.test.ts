import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  getJson,
  patchJson,
} from '@/src/__tests__/helpers/e2e'

describe('GET & PATCH /api/workspaces/[id]/crm/settings', () => {
  it('should serve the defaults and let the owner customize them', async () => {
    const { user, workspace } = await authenticatedOwner()

    const initial = await getJson(
      `/api/workspaces/${workspace.id}/crm/settings`,
      user.cookie,
    )
    expect(initial.status).toBe(200)
    const initialBody = await initial.json()
    expect(initialBody.data).toMatchObject({
      leadReopenStage: 'RECEIVED',
      proposalValidityDays: 15,
      notifyProposalExpiry: true,
      isDefault: true,
    })

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/settings`,
      { leadReopenStage: 'IN_CONTACT', proposalValidityDays: 30 },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data).toMatchObject({
      leadReopenStage: 'IN_CONTACT',
      proposalValidityDays: 30,
      isDefault: false,
    })
  })

  it('should let a member read but not change the settings', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const read = await getJson(
      `/api/workspaces/${workspace.id}/crm/settings`,
      member.cookie,
    )
    expect(read.status).toBe(200)

    const write = await patchJson(
      `/api/workspaces/${workspace.id}/crm/settings`,
      { proposalValidityDays: 30 },
      member.cookie,
    )
    expect(write.status).toBe(403)
  })

  it('should reject invalid values', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/settings`,
      { proposalValidityDays: 0, leadReopenStage: 'CLOSED' },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should return 403 to a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/settings`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})
