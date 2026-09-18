import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  createWorkspaceForUser,
  defaultHeaders,
  getJson,
  patchJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

async function createPlatformAdmin() {
  const user = await createAuthenticatedUser({
    email: `admin-${Date.now()}@stratustelecom.com.br`,
  })
  await prisma.user.update({
    where: { id: user.id },
    data: { isPlatformAdmin: true },
  })
  return user
}

type FeatureRow = { key: string; enabled: boolean; override: unknown }

describe('GET /api/admin/workspaces/[id]/features', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/workspaces/ws1/features`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/features`,
      user.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should list the catalog with plan defaults for a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/features`,
      admin.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    const ai = body.data.find((f: FeatureRow) => f.key === 'crm.aiAssistant')
    expect(ai).toMatchObject({ enabled: true, override: null })
  })
})

describe('PATCH /api/admin/workspaces/[id]/features', () => {
  it('should return 422 for a key outside the catalog', async () => {
    const admin = await createPlatformAdmin()
    const ws = await createWorkspaceForUser(admin.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/features`,
      { key: 'crm.nope', enabled: true },
      admin.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should turn a feature off, reflect it for members and restore the default', async () => {
    const admin = await createPlatformAdmin()
    const owner = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(owner.id)

    const off = await patchJson(
      `/api/admin/workspaces/${ws.id}/features`,
      {
        key: 'communication.broadcasts',
        enabled: false,
        note: 'Pausado a pedido do cliente',
      },
      admin.cookie,
    )
    expect(off.status).toBe(200)
    const offBody = await off.json()
    const row = offBody.data.find(
      (f: FeatureRow) => f.key === 'communication.broadcasts',
    )
    expect(row.enabled).toBe(false)

    const memberView = await getJson(
      `/api/workspaces/${ws.id}/features`,
      owner.cookie,
    )
    expect(memberView.status).toBe(200)
    expect((await memberView.json()).data['communication.broadcasts']).toBe(
      false,
    )

    const reset = await patchJson(
      `/api/admin/workspaces/${ws.id}/features`,
      { key: 'communication.broadcasts', enabled: null },
      admin.cookie,
    )
    expect(reset.status).toBe(200)

    const after = await getJson(
      `/api/workspaces/${ws.id}/features`,
      owner.cookie,
    )
    expect((await after.json()).data['communication.broadcasts']).toBe(true)
  })
})

describe('GET /api/workspaces/[id]/features', () => {
  it('should return 403 for a non-member', async () => {
    const owner = await createAuthenticatedUser()
    const outsider = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(owner.id)

    const res = await getJson(
      `/api/workspaces/${ws.id}/features`,
      outsider.cookie,
    )
    expect(res.status).toBe(403)
  })
})
