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

const MANUAL_DEFINITION = {
  triggerType: 'MANUAL',
  definition: {
    nodes: [{ id: 'n1', type: 'CREATE_TASK', config: { title: 'Ligar' } }],
  },
}

describe('GET /api/workspaces/[id]/crm/workflows', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/workflows`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/workflows`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/workflows', () => {
  it('should create a MANUAL workflow with no webhookToken', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows`,
      { name: 'Boas-vindas', ...MANUAL_DEFINITION },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('DRAFT')
    expect(body.data.webhookToken).toBeNull()
  })

  it('should reject a definition with no nodes', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows`,
      { name: 'Vazio', triggerType: 'MANUAL', definition: { nodes: [] } },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/workflows/[workflowId]', () => {
  it('should update and soft delete a workflow', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/workflows`,
        { name: 'Boas-vindas', ...MANUAL_DEFINITION },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}`,
      { name: 'Boas-vindas 2' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.name).toBe('Boas-vindas 2')

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('POST activate/deactivate', () => {
  it('should toggle workflow status', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/workflows`,
        { name: 'Boas-vindas', ...MANUAL_DEFINITION },
        user.cookie,
      )
    ).json()

    const activated = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/activate`,
      {},
      user.cookie,
    )
    expect(activated.status).toBe(200)
    const activatedBody = await activated.json()
    expect(activatedBody.data.status).toBe('ACTIVE')

    const deactivated = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/deactivate`,
      {},
      user.cookie,
    )
    expect(deactivated.status).toBe(200)
    const deactivatedBody = await deactivated.json()
    expect(deactivatedBody.data.status).toBe('DEACTIVATED')
  })
})

describe('POST /api/workspaces/[id]/crm/workflows/[workflowId]/run', () => {
  it('should run a workflow manually and record a run + steps', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/workflows`,
        { name: 'Boas-vindas', ...MANUAL_DEFINITION },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/run`,
      { payload: { source: 'manual-test' } },
      user.cookie,
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('COMPLETED')

    const runs = await getJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/runs`,
      user.cookie,
    )
    expect(runs.status).toBe(200)
    const runsBody = await runs.json()
    expect(runsBody.data).toHaveLength(1)
    expect(runsBody.data[0].triggerType).toBe('MANUAL')
  })
})

describe('POST /api/crm/workflows/[webhookToken]/trigger', () => {
  it('should reject when the workflow is MANUAL-only', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/workflows`,
        { name: 'Boas-vindas', ...MANUAL_DEFINITION },
        user.cookie,
      )
    ).json()

    const res = await fetch(
      `${BASE_URL}/api/crm/workflows/${created.data.id}/trigger`,
      {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(404)
  })

  it('should trigger an ACTIVE WEBHOOK workflow without authentication', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/workflows`,
        {
          name: 'Webhook workflow',
          triggerType: 'WEBHOOK',
          definition: MANUAL_DEFINITION.definition,
        },
        user.cookie,
      )
    ).json()
    expect(created.data.webhookToken).toBeTruthy()

    await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/activate`,
      {},
      user.cookie,
    )

    const res = await fetch(
      `${BASE_URL}/api/crm/workflows/${created.data.webhookToken}/trigger`,
      {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
      },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('COMPLETED')
    expect(body.data.triggerType).toBe('WEBHOOK')
  })
})
