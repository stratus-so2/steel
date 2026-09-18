import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  createWorkspaceForUser,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
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

describe('PATCH /api/admin/workspaces/[id]/status', () => {
  it('should return 403 for a non-platform-admin (even the owner)', async () => {
    const owner = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(owner.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/status`,
      { action: 'suspend', reason: 'tentativa do dono' },
      owner.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should require a reason', async () => {
    const admin = await createPlatformAdmin()
    const ws = await createWorkspaceForUser(admin.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/status`,
      { action: 'suspend', reason: '' },
      admin.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should block members with WORKSPACE_SUSPENDED and unblock on reactivation', async () => {
    const admin = await createPlatformAdmin()
    const owner = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(owner.id)

    const suspended = await patchJson(
      `/api/admin/workspaces/${ws.id}/status`,
      { action: 'suspend', reason: 'inadimplência há 60 dias' },
      admin.cookie,
    )
    expect(suspended.status).toBe(200)
    expect((await suspended.json()).data.status).toBe('SUSPENDED')

    const blocked = await getJson(
      `/api/workspaces/${ws.id}/features`,
      owner.cookie,
    )
    expect(blocked.status).toBe(403)
    expect((await blocked.json()).error?.code ?? '').toBe('WORKSPACE_SUSPENDED')

    const reactivated = await patchJson(
      `/api/admin/workspaces/${ws.id}/status`,
      { action: 'reactivate', reason: 'pagamento regularizado' },
      admin.cookie,
    )
    expect(reactivated.status).toBe(200)

    const allowed = await getJson(
      `/api/workspaces/${ws.id}/features`,
      owner.cookie,
    )
    expect(allowed.status).toBe(200)

    const audit = await getJson(
      `/api/admin/workspaces/${ws.id}/audit`,
      admin.cookie,
    )
    const actions = (await audit.json()).data.map(
      (e: { action: string }) => e.action,
    )
    expect(actions).toEqual(['workspace.reactivate', 'workspace.suspend'])
  })
})

describe('PATCH /api/admin/workspaces/[id]/plan', () => {
  it('should change the plan manually', async () => {
    const admin = await createPlatformAdmin()
    const owner = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(owner.id)

    const res = await patchJson(
      `/api/admin/workspaces/${ws.id}/plan`,
      { plan: 'ENTERPRISE', reason: 'contrato negociado' },
      admin.cookie,
    )
    expect(res.status).toBe(200)
    const row = await prisma.workspace.findUnique({ where: { id: ws.id } })
    expect(row?.activePlan).toBe('ENTERPRISE')
  })
})

describe('POST /api/admin/workspaces/[id]/deletion', () => {
  it('should reject a wrong slug without touching the workspace', async () => {
    const admin = await createPlatformAdmin()
    const owner = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(owner.id)

    const res = await postJson(
      `/api/admin/workspaces/${ws.id}/deletion`,
      { confirmSlug: 'nao-e-esse', reason: 'encerramento do contrato' },
      admin.cookie,
    )
    expect(res.status).toBe(422)
    const row = await prisma.workspace.findUnique({ where: { id: ws.id } })
    expect(row?.status).toBe('ACTIVE')
  })

  it('should queue the deletion (202) and block the workspace right away', async () => {
    const admin = await createPlatformAdmin()
    const owner = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(owner.id)

    const res = await postJson(
      `/api/admin/workspaces/${ws.id}/deletion`,
      { confirmSlug: ws.slug, reason: 'encerramento do contrato' },
      admin.cookie,
    )
    expect(res.status).toBe(202)
    const operation = (await res.json()).data
    expect(operation).toMatchObject({
      kind: 'WORKSPACE_DELETE',
      workspaceSlug: ws.slug,
    })

    const row = await prisma.workspace.findUnique({ where: { id: ws.id } })
    expect(row?.status).toBe('DELETING')

    const again = await postJson(
      `/api/admin/workspaces/${ws.id}/deletion`,
      { confirmSlug: ws.slug, reason: 'encerramento do contrato' },
      admin.cookie,
    )
    expect(again.status).toBe(409)

    const progress = await getJson(
      `/api/admin/operations/${operation.id}`,
      admin.cookie,
    )
    expect(progress.status).toBe(200)
  })
})

describe('admin backups & overview', () => {
  it('should list backups for a platform admin only', async () => {
    const admin = await createPlatformAdmin()
    const user = await createAuthenticatedUser()

    expect((await getJson('/api/admin/backups', user.cookie)).status).toBe(403)

    const res = await getJson('/api/admin/backups?scope=FULL', admin.cookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveProperty('offsiteConfigured')
    expect(Array.isArray(body.data.backups)).toBe(true)
  })

  it('should refuse a download without a valid signature', async () => {
    const admin = await createPlatformAdmin()
    const backup = await prisma.backup.create({
      data: {
        scope: 'FULL',
        status: 'COMPLETED',
        storageKey: 'full/x.dump.enc',
      },
    })

    const res = await getJson(
      `/api/admin/backups/${backup.id}/download?exp=9999999999&sig=${'a'.repeat(64)}`,
      admin.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should return 404 for a download link of an unknown backup', async () => {
    const admin = await createPlatformAdmin()
    const res = await postJson(
      '/api/admin/backups/missing/download-link',
      {},
      admin.cookie,
    )
    expect(res.status).toBe(404)
  })

  it('should render the overview for a platform admin', async () => {
    const admin = await createPlatformAdmin()
    const res = await getJson('/api/admin/overview', admin.cookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.workspaces.total).toBeGreaterThanOrEqual(0)
  })
})
