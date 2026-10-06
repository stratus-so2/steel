import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  getJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'

describe('/api/workspaces/[id]/notifications/preferences', () => {
  it('should list every configurable kind enabled by default and save a mute', async () => {
    const { user, workspace } = await authenticatedOwner()
    const base = `/api/workspaces/${workspace.id}/notifications/preferences`

    const list = await getJson(base, user.cookie)
    expect(list.status).toBe(200)
    const items = (await list.json()).data as {
      kind: string
      module: string
      inApp: boolean
    }[]
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.inApp)).toBe(true)
    expect(items.some((item) => item.module === 'SERVICE_DESK')).toBe(false)
    expect(items.map((item) => item.kind)).toContain('CRM_LEAD_ASSIGNED')

    const saved = await putJson(
      base,
      { preferences: [{ kind: 'CRM_LEAD_ASSIGNED', inApp: false }] },
      user.cookie,
    )
    expect(saved.status).toBe(200)
    const after = (await saved.json()).data as {
      kind: string
      inApp: boolean
    }[]
    expect(after.find((i) => i.kind === 'CRM_LEAD_ASSIGNED')?.inApp).toBe(false)
  })

  it('should reject a ServiceDesk kind', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await putJson(
      `/api/workspaces/${workspace.id}/notifications/preferences`,
      { preferences: [{ kind: 'SD_TICKET_ASSIGNED', inApp: false }] },
      user.cookie,
    )

    expect(res.status).toBe(422)
  })

  it('should forbid non-members', async () => {
    const { workspace } = await authenticatedOwner()
    const { user: outsider } = await authenticatedOwner()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/notifications/preferences`,
      outsider.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should require a session', async () => {
    const { workspace } = await authenticatedOwner()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/notifications/preferences`,
    )

    expect(res.status).toBe(401)
  })
})
