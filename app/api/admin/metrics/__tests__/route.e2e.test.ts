import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

describe('GET /api/admin/metrics', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/metrics`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const res = await getJson('/api/admin/metrics', user.cookie)
    expect(res.status).toBe(403)
  })

  it('should return the overview for a platform admin', async () => {
    const admin = await createAuthenticatedUser({
      email: `admin-${Date.now()}@stratustelecom.com.br`,
    })
    await prisma.user.update({
      where: { id: admin.id },
      data: { isPlatformAdmin: true },
    })

    const res = await getJson('/api/admin/metrics', admin.cookie)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ windowDays: 30 })
    expect(body.data.churnByMonth).toHaveLength(12)
    expect(body.data.usage.totals).toHaveLength(3)
  })
})
