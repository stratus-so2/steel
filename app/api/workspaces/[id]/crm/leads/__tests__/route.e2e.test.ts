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

describe('GET /api/workspaces/[id]/crm/leads', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces/some-id/crm/leads`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/leads', () => {
  it('should create a lead scored by active scoring rules', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/lead-scoring-rules`,
      { field: 'email', operator: 'is_not_empty', points: 15 },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.score).toBe(15)
  })

  it('should route a lead to the owner of the first matching rule', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/lead-routing-rules`,
      { field: 'source', operator: 'equals', value: 'ads', ownerId: user.id },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.ownerId).toBe(user.id)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/leads/[leadId]', () => {
  it('should update a lead', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}`,
      { status: 'WORKING' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.status).toBe('WORKING')
  })

  it('should soft delete a lead', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('POST /api/workspaces/[id]/crm/leads/[leadId]/convert', () => {
  it('should convert a lead into a CRM person', async () => {
    const { user, workspace } = await authenticatedOwner()
    const lead = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${lead.data.id}/convert`,
      {},
      user.cookie,
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Jane Doe')

    const leadAfter = await getJson(
      `/api/workspaces/${workspace.id}/crm/leads/${lead.data.id}`,
      user.cookie,
    )
    const leadAfterBody = await leadAfter.json()
    expect(leadAfterBody.data.status).toBe('CONVERTED')
    expect(leadAfterBody.data.convertedPersonId).toBe(body.data.id)
  })

  it('should return 409 when converting an already converted lead', async () => {
    const { user, workspace } = await authenticatedOwner()
    const lead = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${lead.data.id}/convert`,
      {},
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${lead.data.id}/convert`,
      {},
      user.cookie,
    )
    expect(res.status).toBe(409)
  })
})
