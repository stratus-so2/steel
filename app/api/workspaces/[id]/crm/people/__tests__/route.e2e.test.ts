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

describe('GET /api/workspaces/[id]/crm/people', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces/some-id/crm/people`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/people', () => {
  it('should create a person for a workspace member', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      { name: 'Jane Doe', emails: ['jane@acme.com'] },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Jane Doe')
  })

  it('should return 422 for invalid payload', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      { name: '' },
      user.cookie,
    )

    expect(res.status).toBe(422)
  })

  it('should link a person to a company', async () => {
    const { user, workspace } = await authenticatedOwner()
    const company = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/companies`,
        { name: 'Acme' },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      { name: 'Jane Doe', companyId: company.data.id },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.companyId).toBe(company.data.id)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/people/[personId]', () => {
  it('should update a person', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      { name: 'Jane' },
      user.cookie,
    )
    const { data: person } = await created.json()

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/people/${person.id}`,
      { name: 'Jane Doe' },
      user.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Jane Doe')
  })

  it('should soft delete a person and hide it from listing', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      { name: 'Jane' },
      user.cookie,
    )
    const { data: person } = await created.json()

    const res = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/people/${person.id}`,
      user.cookie,
    )
    expect(res.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      user.cookie,
    )
    const body = await list.json()
    expect(body.data).toEqual([])
  })
})

describe('PATCH /api/workspaces/[id]/crm/people/reorder', () => {
  it('should reorder people', async () => {
    const { user, workspace } = await authenticatedOwner()
    const a = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/people`,
        { name: 'A' },
        user.cookie,
      )
    ).json()
    const b = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/people`,
        { name: 'B' },
        user.cookie,
      )
    ).json()

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/people/reorder`,
      { orderedIds: [b.data.id, a.data.id] },
      user.cookie,
    )
    expect(res.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/people`,
      user.cookie,
    )
    const body = await list.json()
    expect(body.data.map((p: { id: string }) => p.id)).toEqual([
      b.data.id,
      a.data.id,
    ])
  })
})
