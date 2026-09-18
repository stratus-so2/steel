import { describe, expect, it } from 'vitest'
import { createAuthenticatedUser, postJson } from '@/src/__tests__/helpers/e2e'
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

describe('POST /api/admin/changelog/release-draft', () => {
  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const res = await postJson(
      '/api/admin/changelog/release-draft',
      { source: 'manual', markdown: '- feat: x' },
      user.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should return 422 for blank pasted notes', async () => {
    const admin = await createPlatformAdmin()
    const res = await postJson(
      '/api/admin/changelog/release-draft',
      { source: 'manual', markdown: '' },
      admin.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should convert pasted notes into a draft', async () => {
    const admin = await createPlatformAdmin()
    const res = await postJson(
      '/api/admin/changelog/release-draft',
      {
        source: 'manual',
        markdown: '- feat(crm): novo funil\n- chore: deps\n- ci: cache',
      },
      admin.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.items).toEqual([
      { title: 'Novidades', body: '• CRM: Novo funil' },
    ])
    expect(body.data.skipped).toBe(2)
  })
})
