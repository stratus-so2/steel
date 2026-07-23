import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('GET /api/workspaces/[id]/crm/email-messages', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/email-messages`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })
})

describe('POST & DELETE /api/workspaces/[id]/crm/email-messages', () => {
  it('should log and remove an email message', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-messages`,
      {
        direction: 'OUTBOUND',
        fromEmail: 'me@example.com',
        toEmails: ['lead@example.com'],
        sentAt: new Date().toISOString(),
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/email-messages`,
      user.cookie,
    )
    expect(list.status).toBe(200)
    const listBody = await list.json()
    expect(listBody.data).toHaveLength(1)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/email-messages/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
