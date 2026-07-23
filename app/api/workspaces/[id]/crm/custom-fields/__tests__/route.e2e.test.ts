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

describe('GET /api/workspaces/[id]/crm/custom-fields', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/custom-fields`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/custom-fields', () => {
  it('should create a custom field definition', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields`,
      { entity: 'COMPANY', key: 'segment', label: 'Segmento' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.key).toBe('segment')
  })

  it('should return 409 on duplicate key for the same entity', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields`,
      { entity: 'COMPANY', key: 'segment', label: 'Segmento' },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields`,
      { entity: 'COMPANY', key: 'segment', label: 'Dup' },
      user.cookie,
    )
    expect(res.status).toBe(409)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/custom-fields/[definitionId]', () => {
  it('should update and soft delete a definition', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/custom-fields`,
        { entity: 'COMPANY', key: 'segment', label: 'Segmento' },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields/${created.data.id}`,
      { label: 'Segmento de mercado' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('CRM custom field values', () => {
  it('should set and read a value for a record', async () => {
    const { user, workspace } = await authenticatedOwner()
    const definition = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/custom-fields`,
        { entity: 'COMPANY', key: 'segment', label: 'Segmento' },
        user.cookie,
      )
    ).json()

    const set = await patchJson(
      `/api/workspaces/${workspace.id}/crm/custom-fields/${definition.data.id}/values/record-1`,
      { value: 'Enterprise' },
      user.cookie,
    )
    expect(set.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/custom-field-values/record-1`,
      user.cookie,
    )
    expect(list.status).toBe(200)
    const body = await list.json()
    expect(body.data[0].value).toBe('Enterprise')
  })
})
