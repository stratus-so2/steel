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

async function seedFunnel(workspaceId: string, cookie: string) {
  const pipeline = await (
    await postJson(
      `/api/workspaces/${workspaceId}/crm/pipelines`,
      { name: 'Vendas' },
      cookie,
    )
  ).json()
  const stage = await (
    await postJson(
      `/api/workspaces/${workspaceId}/crm/pipelines/${pipeline.data.id}/stages`,
      { name: 'Novo' },
      cookie,
    )
  ).json()
  return { pipelineId: pipeline.data.id, stageId: stage.data.id }
}

describe('GET /api/workspaces/[id]/crm/opportunities', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/opportunities`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/opportunities`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/opportunities', () => {
  it('should create an opportunity bound to a pipeline and stage', async () => {
    const { user, workspace } = await authenticatedOwner()
    const { pipelineId, stageId } = await seedFunnel(workspace.id, user.cookie)

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/opportunities`,
      { name: 'Negócio X', pipelineId, stageId },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Negócio X')
    expect(body.data.stageId).toBe(stageId)
  })

  it('should return 422 for invalid payload', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/opportunities`,
      { name: 'Negócio X' },
      user.cookie,
    )

    expect(res.status).toBe(422)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/opportunities/[opportunityId]', () => {
  it('should move an opportunity to another stage and soft delete it', async () => {
    const { user, workspace } = await authenticatedOwner()
    const { pipelineId, stageId } = await seedFunnel(workspace.id, user.cookie)
    const otherStage = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/pipelines/${pipelineId}/stages`,
        { name: 'Ganho' },
        user.cookie,
      )
    ).json()

    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/opportunities`,
        { name: 'Negócio X', pipelineId, stageId },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/opportunities/${created.data.id}`,
      { stageId: otherStage.data.id },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.stageId).toBe(otherStage.data.id)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/opportunities/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('CRM opportunity line items', () => {
  it('should create a line item and compute its total', async () => {
    const { user, workspace } = await authenticatedOwner()
    const { pipelineId, stageId } = await seedFunnel(workspace.id, user.cookie)
    const opportunity = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/opportunities`,
        { name: 'Negócio X', pipelineId, stageId },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/opportunities/${opportunity.data.id}/line-items`,
      { name: 'Licença', quantity: 2, unitPrice: 100, discountPct: 10 },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.total).toBe(180)
  })

  it('should update and delete a line item', async () => {
    const { user, workspace } = await authenticatedOwner()
    const { pipelineId, stageId } = await seedFunnel(workspace.id, user.cookie)
    const opportunity = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/opportunities`,
        { name: 'Negócio X', pipelineId, stageId },
        user.cookie,
      )
    ).json()
    const item = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/opportunities/${opportunity.data.id}/line-items`,
        { name: 'Licença', quantity: 1, unitPrice: 50 },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/opportunities/${opportunity.data.id}/line-items/${item.data.id}`,
      { quantity: 3 },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.total).toBe(150)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/opportunities/${opportunity.data.id}/line-items/${item.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
