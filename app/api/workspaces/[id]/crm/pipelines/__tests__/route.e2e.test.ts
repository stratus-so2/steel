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

describe('GET /api/workspaces/[id]/crm/pipelines', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/pipelines`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/pipelines`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/pipelines', () => {
  it('should create a pipeline for a workspace member', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/pipelines`,
      { name: 'Vendas' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Vendas')
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/pipelines/[pipelineId]', () => {
  it('should update and soft delete a pipeline', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/pipelines`,
        { name: 'Vendas' },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/pipelines/${created.data.id}`,
      { name: 'Funil B2B' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/pipelines/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/pipelines`,
      user.cookie,
    )
    const body = await list.json()
    expect(body.data).toEqual([])
  })
})

describe('CRM pipeline stages', () => {
  it('should create, list and reorder stages within a pipeline', async () => {
    const { user, workspace } = await authenticatedOwner()
    const pipeline = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/pipelines`,
        { name: 'Vendas' },
        user.cookie,
      )
    ).json()
    const pipelineId = pipeline.data.id

    const a = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages`,
        { name: 'Novo' },
        user.cookie,
      )
    ).json()
    const b = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages`,
        { name: 'Qualificado' },
        user.cookie,
      )
    ).json()

    expect(a.data.name).toBe('Novo')
    expect(b.data.position).toBe(1)

    const reorder = await patchJson(
      `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages/reorder`,
      { orderedIds: [b.data.id, a.data.id] },
      user.cookie,
    )
    expect(reorder.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages`,
      user.cookie,
    )
    const body = await list.json()
    expect(body.data.map((s: { id: string }) => s.id)).toEqual([
      b.data.id,
      a.data.id,
    ])
  })

  it('should update and delete a stage', async () => {
    const { user, workspace } = await authenticatedOwner()
    const pipeline = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/pipelines`,
        { name: 'Vendas' },
        user.cookie,
      )
    ).json()
    const pipelineId = pipeline.data.id
    const stage = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages`,
        { name: 'Novo' },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages/${stage.data.id}`,
      { probability: 60 },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.probability).toBe(60)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages/${stage.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
