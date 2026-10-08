import { describe, expect, it } from 'vitest'
import { seedWorkspaceExport } from '@/src/__tests__/factories/workspace-export.factory'
import {
  addMember,
  authenticatedOwner,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('Workspace exports routes', () => {
  it('is only for OWNER and ADMIN', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const list = await getJson(
      `/api/workspaces/${workspace.id}/exports`,
      member.cookie,
    )
    expect(list.status).toBe(403)
    const create = await postJson(
      `/api/workspaces/${workspace.id}/exports`,
      { kind: 'DATA' },
      member.cookie,
    )
    expect(create.status).toBe(403)
  })

  it('queues a data export once a day and lists it', async () => {
    const { user, workspace } = await authenticatedOwner()
    const admin = await addMember(workspace.id, 'ADMIN')

    const first = await postJson(
      `/api/workspaces/${workspace.id}/exports`,
      { kind: 'DATA' },
      user.cookie,
    )
    expect(first.status).toBe(202)
    const created = (await first.json()).data
    expect(created.kind).toBe('DATA')
    expect(created.status).toBe('PENDING')
    expect(created.downloadUrl).toBeNull()

    // Another admin on the same day: the slot is per workspace.
    const second = await postJson(
      `/api/workspaces/${workspace.id}/exports`,
      { kind: 'DATA' },
      admin.cookie,
    )
    expect(second.status).toBe(429)
    const body = await second.json()
    expect(body.error.code).toBe('WORKSPACE_EXPORT_LIMIT_REACHED')
    expect(body.error.details.nextAvailableAt).toEqual(expect.any(String))
    expect(body.message).toContain('já foi feita hoje')

    const overview = await getJson(
      `/api/workspaces/${workspace.id}/exports`,
      admin.cookie,
    )
    expect(overview.status).toBe(200)
    const data = (await overview.json()).data
    expect(data.items).toHaveLength(1)
    expect(data.items[0].requestedBy.id).toBe(user.id)
    const dataSlot = data.availability.find(
      (a: { kind: string }) => a.kind === 'DATA',
    )
    expect(dataSlot.available).toBe(false)
    expect(data.retentionDays).toBe(7)
  })

  it('refuses the logs export when Axiom is not configured', async () => {
    const { user, workspace } = await authenticatedOwner()
    const overview = await getJson(
      `/api/workspaces/${workspace.id}/exports`,
      user.cookie,
    )
    const logs = (await overview.json()).data.availability.find(
      (a: { kind: string }) => a.kind === 'LOGS',
    )
    const res = await postJson(
      `/api/workspaces/${workspace.id}/exports`,
      { kind: 'LOGS', periodDays: 7 },
      user.cookie,
    )
    expect(res.status).toBe(logs.configured ? 202 : 503)
  })

  it('validates the body', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await postJson(
      `/api/workspaces/${workspace.id}/exports`,
      { kind: 'LOGS', periodDays: 90 },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('downloads only finished exports of the workspace', async () => {
    const { user, workspace } = await authenticatedOwner()
    const pending = await seedWorkspaceExport(workspace.id, user.id)
    const res = await getJson(
      `/api/workspaces/${workspace.id}/exports/${pending.id}/download`,
      user.cookie,
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('WORKSPACE_EXPORT_NOT_READY')

    const missing = await getJson(
      `/api/workspaces/${workspace.id}/exports/does-not-exist/download`,
      user.cookie,
    )
    expect(missing.status).toBe(404)

    const member = await addMember(workspace.id, 'MEMBER')
    const denied = await getJson(
      `/api/workspaces/${workspace.id}/exports/${pending.id}/download`,
      member.cookie,
    )
    expect(denied.status).toBe(403)
  })
})
