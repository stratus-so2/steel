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

function manualTriggerDefinition() {
  return {
    trigger: {
      id: 'trigger',
      position: { x: 0, y: 0 },
      data: { type: 'launch-manually', inputs: [] },
    },
    nodes: [
      {
        id: 'n1',
        position: { x: 200, y: 0 },
        data: {
          type: 'create-record',
          entity: 'task',
          fields: { title: 'Ligar' },
        },
      },
    ],
    edges: [{ id: 'e1', source: 'trigger', target: 'n1' }],
  }
}

async function createWorkflow(
  workspaceId: string,
  cookie: string,
  name = 'Boas-vindas',
) {
  const res = await postJson(
    `/api/workspaces/${workspaceId}/crm/workflows`,
    { name },
    cookie,
  )
  return res.json()
}

describe('GET /api/workspaces/[id]/crm/workflows', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/workflows`,
      {
        headers: defaultHeaders,
      },
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
  it('should create a workflow with an empty DRAFT and no active version', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows`,
      { name: 'Boas-vindas' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('DRAFT')
    expect(body.data.activeVersionId).toBeNull()
  })

  it('should reject an empty name', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows`,
      { name: '' },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })
})

describe('draft: GET & PATCH', () => {
  it('should fetch the empty draft and then persist a full definition', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createWorkflow(workspace.id, user.cookie)

    const draft = await getJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/draft`,
      user.cookie,
    )
    expect(draft.status).toBe(200)
    const draftBody = await draft.json()
    expect(draftBody.data.status).toBe('DRAFT')
    expect(draftBody.data.definition.trigger.data).toBeNull()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/draft`,
      { definition: manualTriggerDefinition() },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.definition.nodes).toHaveLength(1)
  })

  it('should reject an invalid definition (edge to unknown node)', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createWorkflow(workspace.id, user.cookie)

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/draft`,
      {
        definition: {
          trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
          nodes: [],
          edges: [{ id: 'e1', source: 'trigger', target: 'ghost' }],
        },
      },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/workflows/[workflowId]', () => {
  it('should update and soft delete a workflow', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createWorkflow(workspace.id, user.cookie)

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

describe('POST activate/deactivate/discard', () => {
  it('should reject activation without a configured trigger', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createWorkflow(workspace.id, user.cookie)

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/activate`,
      {},
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should activate a configured draft, then deactivate, then discard further edits', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createWorkflow(workspace.id, user.cookie)

    await patchJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/draft`,
      { definition: manualTriggerDefinition() },
      user.cookie,
    )

    const activated = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/activate`,
      {},
      user.cookie,
    )
    expect(activated.status).toBe(200)
    const activatedBody = await activated.json()
    expect(activatedBody.data.status).toBe('ACTIVE')
    expect(activatedBody.data.activeVersionId).toBeTruthy()

    const deactivated = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/deactivate`,
      {},
      user.cookie,
    )
    expect(deactivated.status).toBe(200)
    const deactivatedBody = await deactivated.json()
    expect(deactivatedBody.data.status).toBe('DEACTIVATED')

    // Edita o novo draft criado pela ativação, então descarta.
    await patchJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/draft`,
      {
        definition: {
          trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
          nodes: [],
          edges: [],
        },
      },
      user.cookie,
    )
    const discarded = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/discard`,
      {},
      user.cookie,
    )
    expect(discarded.status).toBe(200)
    const discardedBody = await discarded.json()
    expect(discardedBody.data.definition.nodes).toHaveLength(1)
  })
})

describe('POST /api/workspaces/[id]/crm/workflows/[workflowId]/trigger', () => {
  it('should run a workflow manually (test mode, against the draft) and record a run + steps', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createWorkflow(workspace.id, user.cookie)
    await patchJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/draft`,
      { definition: manualTriggerDefinition() },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/trigger`,
      { test: true, payload: { source: 'manual-test' } },
      user.cookie,
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('COMPLETED')
    expect(body.data.steps).toHaveLength(1)

    const runs = await getJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/runs`,
      user.cookie,
    )
    expect(runs.status).toBe(200)
    const runsBody = await runs.json()
    expect(runsBody.data).toHaveLength(1)
    expect(runsBody.data[0].triggerType).toBe('launch-manually')

    const singleRun = await getJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/runs/${body.data.id}`,
      user.cookie,
    )
    expect(singleRun.status).toBe(200)
  })
})

describe('POST /api/crm/workflows/[webhookToken]/trigger', () => {
  it('should reject an unknown token', async () => {
    const res = await fetch(
      `${BASE_URL}/api/crm/workflows/unknown-token/trigger`,
      {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    )
    expect(res.status).toBe(404)
  })

  it('should trigger an ACTIVE webhook workflow without authentication', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createWorkflow(
      workspace.id,
      user.cookie,
      'Webhook workflow',
    )
    const token = 'e2e-webhook-token-12345'

    await patchJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/draft`,
      {
        definition: {
          trigger: {
            id: 'trigger',
            position: { x: 0, y: 0 },
            data: { type: 'webhook', token },
          },
          nodes: [],
          edges: [],
        },
      },
      user.cookie,
    )
    await postJson(
      `/api/workspaces/${workspace.id}/crm/workflows/${created.data.id}/activate`,
      {},
      user.cookie,
    )

    const res = await fetch(`${BASE_URL}/api/crm/workflows/${token}/trigger`, {
      method: 'POST',
      headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.status).toBe('COMPLETED')
    expect(body.data.triggerType).toBe('webhook')
  })
})
