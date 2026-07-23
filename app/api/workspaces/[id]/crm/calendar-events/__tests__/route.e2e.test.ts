import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('GET /api/workspaces/[id]/crm/calendar-events', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/calendar-events`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })
})

describe('POST, PATCH & DELETE /api/workspaces/[id]/crm/calendar-events', () => {
  it('should create, update and delete an event', async () => {
    const { user, workspace } = await authenticatedOwner()

    const now = new Date().toISOString()
    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/calendar-events`,
      { title: 'Reunião', startsAt: now, endsAt: now },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/calendar-events/${createdBody.data.id}`,
      { title: 'Reunião atualizada' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.title).toBe('Reunião atualizada')

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/calendar-events/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})
