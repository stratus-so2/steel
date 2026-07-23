import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('CRM forms CRUD', () => {
  it('should create, update and delete a form', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/forms`,
      {
        name: 'Contato',
        action: 'LEAD',
        fields: [{ key: 'name', label: 'Nome', type: 'text', required: true }],
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.publicToken).toBeTruthy()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/forms/${createdBody.data.id}`,
      { name: 'Contato 2' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/forms/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('CRM form publish and public submit', () => {
  it('should publish a form and accept a public submission that creates a lead', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/forms`,
        { name: 'Contato', action: 'LEAD' },
        user.cookie,
      )
    ).json()

    const beforePublish = await fetch(
      `${BASE_URL}/api/crm/forms/${created.data.publicToken}`,
      { headers: defaultHeaders },
    )
    expect(beforePublish.status).toBe(422)

    await postJson(
      `/api/workspaces/${workspace.id}/crm/forms/${created.data.id}/publish`,
      {},
      user.cookie,
    )

    const publicForm = await fetch(
      `${BASE_URL}/api/crm/forms/${created.data.publicToken}`,
      { headers: defaultHeaders },
    )
    expect(publicForm.status).toBe(200)

    const submitRes = await fetch(
      `${BASE_URL}/api/crm/forms/${created.data.publicToken}/submit`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          values: { name: 'Jane Doe', email: 'jane@acme.com' },
        }),
      },
    )
    expect(submitRes.status).toBe(201)
    const submitBody = await submitRes.json()
    expect(submitBody.data.createdLeadId).toBeTruthy()

    const submissions = await getJson(
      `/api/workspaces/${workspace.id}/crm/forms/${created.data.id}/submissions`,
      user.cookie,
    )
    const submissionsBody = await submissions.json()
    expect(submissionsBody.data).toHaveLength(1)

    const leads = await getJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      user.cookie,
    )
    const leadsBody = await leads.json()
    expect(
      leadsBody.data.some(
        (l: { id: string }) => l.id === submitBody.data.createdLeadId,
      ),
    ).toBe(true)
  })
})
