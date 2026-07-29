import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  createWorkspaceForUser,
  defaultHeaders,
  getJson,
  patchJson,
  postJson,
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

describe('GET /api/admin/workspaces', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/workspaces`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 for an authenticated non-platform-admin', async () => {
    const user = await createAuthenticatedUser()

    const res = await getJson('/api/admin/workspaces', user.cookie)

    expect(res.status).toBe(403)
  })

  it('should list workspaces with member counts for a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id, { name: 'Listed Ws' })

    const res = await getJson('/api/admin/workspaces', admin.cookie)

    expect(res.status).toBe(200)
    const body = await res.json()
    const found = body.data.find((w: { id: string }) => w.id === ws.id)
    expect(found).toBeDefined()
    expect(found.memberCount).toBe(1)
  })
})

describe('GET /api/admin/workspaces/[id]', () => {
  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await getJson(`/api/admin/workspaces/${ws.id}`, user.cookie)

    expect(res.status).toBe(403)
  })

  it('should return the workspace for a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id, { name: 'Detail Ws' })

    const res = await getJson(`/api/admin/workspaces/${ws.id}`, admin.cookie)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Detail Ws')
  })
})

describe('GET /api/admin/workspaces/[id]/members', () => {
  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/members`,
      user.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should list members for a platform admin who is not a member', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/members`,
      admin.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].userId).toBe(other.id)
  })
})

describe('PATCH /api/admin/workspaces/[id]/members/[userId]/profile', () => {
  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/members/${user.id}/profile`,
      { profileId: null },
      user.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should assign a profile for a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const profilesRes = await getJson(
      `/api/admin/workspaces/${ws.id}/profiles`,
      admin.cookie,
    )
    const profiles = (await profilesRes.json()).data
    const memberProfile = profiles.find(
      (p: { systemKey: string }) => p.systemKey === 'MEMBER',
    )

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/members/${other.id}/profile`,
      { profileId: memberProfile.id },
      admin.cookie,
    )

    expect(res.status).toBe(200)
  })
})

describe('GET/POST /api/admin/workspaces/[id]/profiles', () => {
  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/profiles`,
      user.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should seed and list the 3 system profiles for a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/profiles`,
      admin.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
    expect(body.data.every((p: { isSystem: boolean }) => p.isSystem)).toBe(true)
  })

  it('should create a custom profile as a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const res = await postJson(
      `/api/admin/workspaces/${ws.id}/profiles`,
      { name: 'Suporte', permissions: { members: ['VIEW'] } },
      admin.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Suporte')
    expect(body.data.isSystem).toBe(false)
  })
})

describe('PATCH/DELETE /api/admin/workspaces/[id]/profiles/[profileId]', () => {
  it('should update a custom profile as a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const created = (
      await (
        await postJson(
          `/api/admin/workspaces/${ws.id}/profiles`,
          { name: 'Editable', permissions: {} },
          admin.cookie,
        )
      ).json()
    ).data

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/profiles/${created.id}`,
      { name: 'Renamed' },
      admin.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.name).toBe('Renamed')
  })

  it('should return 409 PROFILE_SYSTEM_PROTECTED when deleting a system profile', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const profilesRes = await getJson(
      `/api/admin/workspaces/${ws.id}/profiles`,
      admin.cookie,
    )
    const memberProfile = (await profilesRes.json()).data.find(
      (p: { systemKey: string }) => p.systemKey === 'MEMBER',
    )

    const res = await fetch(
      `${BASE_URL}/api/admin/workspaces/${ws.id}/profiles/${memberProfile.id}`,
      {
        method: 'DELETE',
        headers: { ...defaultHeaders, Cookie: admin.cookie },
      },
    )

    expect(res.status).toBe(409)
  })
})
