import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  createWorkspaceForUser,
  defaultHeaders,
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

// Este app usa streaming/Cache Components: o status HTTP permanece 200
// mesmo quando `notFound()` dispara mais fundo na árvore (ver
// module-access-guard.e2e.test.ts). O sinal confiável é o marcador RSC.
describe('Admin pages', () => {
  it('should block /admin/workspaces for an authenticated non-platform-admin', async () => {
    const user = await createAuthenticatedUser()

    const res = await fetch(`${BASE_URL}/admin/workspaces`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('NEXT_HTTP_ERROR_FALLBACK;404')
  })

  it('should render /admin/workspaces for a platform admin', async () => {
    const admin = await createPlatformAdmin()

    const res = await fetch(`${BASE_URL}/admin/workspaces`, {
      headers: { ...defaultHeaders, Cookie: admin.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })

  it('should render an admin workspace detail page without a server error', async () => {
    const admin = await createPlatformAdmin()
    const other = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(other.id)

    const res = await fetch(`${BASE_URL}/admin/workspaces/${ws.id}`, {
      headers: { ...defaultHeaders, Cookie: admin.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })

  it('should block an admin workspace detail page for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const ws = await createWorkspaceForUser(user.id)

    const res = await fetch(`${BASE_URL}/admin/workspaces/${ws.id}`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('NEXT_HTTP_ERROR_FALLBACK;404')
  })
})
