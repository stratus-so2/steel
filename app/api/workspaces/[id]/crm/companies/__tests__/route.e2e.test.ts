import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('GET /api/workspaces/[id]/crm/companies', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/companies`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should return an empty list for a workspace with no companies', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      user.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
  })
})

describe('POST /api/workspaces/[id]/crm/companies', () => {
  it('should create a company for a workspace member', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme Inc.' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Acme Inc.')
  })

  it('should return 422 for invalid payload', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: '' },
      user.cookie,
    )

    expect(res.status).toBe(422)
  })

  it('should apply and flatten custom field values', async () => {
    const { user, workspace } = await authenticatedOwner()

    const defRes = await postJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields`,
      { entity: 'COMPANY', key: 'segment', label: 'Segmento' },
      user.cookie,
    )
    expect(defRes.status).toBe(201)
    const def = (await defRes.json()).data

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme Inc.', customFields: { [def.id]: 'Enterprise' } },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.customFields).toEqual({ [`cf_${def.id}`]: 'Enterprise' })

    const listRes = await getJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      user.cookie,
    )
    const list = (await listRes.json()).data
    expect(list[0].customFields).toEqual({ [`cf_${def.id}`]: 'Enterprise' })
  })

  it('should return 409 on duplicate domain', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme', domain: 'acme.com' },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme 2', domain: 'acme.com' },
      user.cookie,
    )

    expect(res.status).toBe(409)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/companies/[companyId]', () => {
  it('should update a company', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme' },
      user.cookie,
    )
    const { data: company } = await created.json()

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/companies/${company.id}`,
      { name: 'Acme Corp' },
      user.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Acme Corp')
  })

  it('should soft delete a company and hide it from listing', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme' },
      user.cookie,
    )
    const { data: company } = await created.json()

    const res = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/companies/${company.id}`,
      user.cookie,
    )
    expect(res.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      user.cookie,
    )
    const body = await list.json()
    expect(body.data).toEqual([])
  })

  it('should reject mutation from a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await addMember(workspace.id, 'MEMBER')
    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      { name: 'Acme' },
      stranger.cookie,
    )
    const { data: company } = await created.json()

    const outsider = await createAuthenticatedUser()
    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/companies/${company.id}`,
      { name: 'Hacked' },
      outsider.cookie,
    )

    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/workspaces/[id]/crm/companies/reorder', () => {
  it('should reorder companies', async () => {
    const { user, workspace } = await authenticatedOwner()
    const a = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/companies`,
        { name: 'A' },
        user.cookie,
      )
    ).json()
    const b = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/companies`,
        { name: 'B' },
        user.cookie,
      )
    ).json()

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/companies/reorder`,
      { orderedIds: [b.data.id, a.data.id] },
      user.cookie,
    )
    expect(res.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/companies`,
      user.cookie,
    )
    const body = await list.json()
    expect(body.data.map((c: { id: string }) => c.id)).toEqual([
      b.data.id,
      a.data.id,
    ])
  })
})
