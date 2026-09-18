import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('CRM integration keys', () => {
  it('should create a key, use it to ingest a lead, then revoke it', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/integration-keys`,
      { name: 'Zapier' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.plaintextKey).toMatch(/^crm_live_/)

    const ingest = await fetch(`${BASE_URL}/api/crm/integrations/leads`, {
      method: 'POST',
      headers: {
        ...defaultHeaders,
        Authorization: `Bearer ${createdBody.data.plaintextKey}`,
      },
      body: JSON.stringify({ name: 'Jane Doe', emails: ['jane@acme.com'] }),
    })
    expect(ingest.status).toBe(201)
    const ingestBody = await ingest.json()
    expect(ingestBody.data.name).toBe('Jane Doe')

    const leads = await getJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      user.cookie,
    )
    const leadsBody = await leads.json()
    expect(
      leadsBody.data.some((l: { id: string }) => l.id === ingestBody.data.id),
    ).toBe(true)

    const revoked = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/integration-keys/${createdBody.data.id}`,
      user.cookie,
    )
    expect(revoked.status).toBe(200)

    const ingestAfterRevoke = await fetch(
      `${BASE_URL}/api/crm/integrations/leads`,
      {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${createdBody.data.plaintextKey}`,
        },
        body: JSON.stringify({ name: 'Other Lead' }),
      },
    )
    expect(ingestAfterRevoke.status).toBe(401)
  })

  it('should score, validate and dedupe ingested leads like manual creation', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/lead-scoring-rules`,
      { field: 'email', operator: 'is_not_empty', points: 15 },
      user.cookie,
    )
    const key = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/integration-keys`,
        { name: 'Zapier' },
        user.cookie,
      )
    ).json()
    const ingest = (payload: unknown) =>
      fetch(`${BASE_URL}/api/crm/integrations/leads`, {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          Authorization: `Bearer ${key.data.plaintextKey}`,
        },
        body: JSON.stringify(payload),
      })

    const first = await ingest({ name: 'Jane', emails: ['jane@acme.com'] })
    expect(first.status).toBe(201)
    const firstBody = await first.json()
    expect(firstBody.data.score).toBe(15)
    expect(firstBody.data.source).toBe('integration')

    const again = await ingest({ name: 'Jane', emails: ['JANE@acme.com'] })
    expect(again.status).toBe(200)
    expect((await again.json()).data.id).toBe(firstBody.data.id)

    const noContact = await ingest({ name: 'Sem contato' })
    expect(noContact.status).toBe(422)
  })

  it('should return 403 for a plain member trying to list keys', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/integration-keys`,
      member.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should return 401 when ingesting without a key', async () => {
    const res = await fetch(`${BASE_URL}/api/crm/integrations/leads`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ name: 'Nobody' }),
    })
    expect(res.status).toBe(401)
  })
})
