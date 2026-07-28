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

describe('GET /api/admin/workspaces/[id]/module-access', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/workspaces/ws1/module-access`,
      {
        headers: defaultHeaders,
      },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 for an authenticated non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      user.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should return 403 for a platform admin outside the required e-mail domain', async () => {
    const user = await createAuthenticatedUser()
    await prisma.user.update({
      where: { id: user.id },
      data: { isPlatformAdmin: true },
    })
    const ws = await createWorkspaceForUser(user.id)

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      user.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should list all 3 modules for a platform admin, defaulting ungranted ones', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)
    // Workspaces de teste nascem com os 3 módulos liberados (default do
    // helper e2e, espelhando o backfill de produção) — para exercitar o
    // caso "nunca concedido" aqui, zera o que o helper já criou.
    await prisma.workspaceModuleAccess.deleteMany({
      where: { workspaceId: ws.id },
    })

    const res = await getJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      admin.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
    expect(
      body.data.every((a: { enabled: boolean }) => a.enabled === false),
    ).toBe(true)
  })
})

describe('PATCH /api/admin/workspaces/[id]/module-access', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/admin/workspaces/ws1/module-access`,
      {
        method: 'PATCH',
        headers: defaultHeaders,
        body: JSON.stringify({ module: 'CRM', enabled: true }),
      },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      { module: 'CRM', enabled: true },
      user.cookie,
    )

    expect(res.status).toBe(403)
  })

  it('should return 422 for an invalid payload', async () => {
    const admin = await createPlatformAdmin()
    const ws = await createWorkspaceForUser(admin.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      { module: 'BILLING', enabled: true },
      admin.cookie,
    )

    expect(res.status).toBe(422)
  })

  it('should grant a module and reflect it on a subsequent list', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const patchRes = await patchJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      { module: 'COMMUNICATION', enabled: true },
      admin.cookie,
    )
    expect(patchRes.status).toBe(200)
    const patchBody = await patchRes.json()
    expect(patchBody.data.enabled).toBe(true)
    expect(patchBody.data.grantedById).toBe(admin.id)

    const listRes = await getJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      admin.cookie,
    )
    const listBody = await listRes.json()
    const communication = listBody.data.find(
      (a: { module: string }) => a.module === 'COMMUNICATION',
    )
    expect(communication.enabled).toBe(true)
  })

  it('should revoke a previously granted module', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    // createWorkspaceForUser já concede CRM por padrão (ver comentário acima).
    const ws = await createWorkspaceForUser(other.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/module-access`,
      { module: 'CRM', enabled: false },
      admin.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.enabled).toBe(false)
  })
})
