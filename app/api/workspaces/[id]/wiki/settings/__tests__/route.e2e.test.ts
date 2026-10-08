import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

describe('GET /api/workspaces/[id]/wiki/settings', () => {
  it('should start with the wiki off', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/wiki/settings`,
      user.cookie,
    )

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ enabled: false })
  })
})

describe('PATCH /api/workspaces/[id]/wiki/settings', () => {
  it('should let the owner turn the wiki on, opening the pages api', async () => {
    const { user, workspace } = await authenticatedOwner()

    const blocked = await postJson(
      `/api/workspaces/${workspace.id}/wiki`,
      {},
      user.cookie,
    )
    expect(blocked.status).toBe(403)
    expect((await blocked.json()).error.code).toBe('WIKI_DISABLED')

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/wiki/settings`,
      { enabled: true },
      user.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ enabled: true })

    const created = await postJson(
      `/api/workspaces/${workspace.id}/wiki`,
      {},
      user.cookie,
    )
    expect(created.status).toBe(201)
  })

  it('should return 403 for a plain member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/wiki/settings`,
      { enabled: true },
      member.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should return 422 for a non-boolean flag', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/wiki/settings`,
      { enabled: 'yes' },
      user.cookie,
    )

    expect(res.status).toBe(422)
  })
})
