import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

async function platformAdmin() {
  const admin = await createAuthenticatedUser({
    email: `admin-${Date.now()}@stratustelecom.com.br`,
  })
  await prisma.user.update({
    where: { id: admin.id },
    data: { isPlatformAdmin: true },
  })
  return admin
}

describe('GET /api/admin/analytics', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/analytics`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 for a non-platform-admin', async () => {
    const user = await createAuthenticatedUser()
    const res = await getJson('/api/admin/analytics', user.cookie)
    expect(res.status).toBe(403)
  })

  it('should validate the filters', async () => {
    const admin = await platformAdmin()
    const bad = await getJson('/api/admin/analytics?range=90d', admin.cookie)
    expect(bad.status).toBe(422)

    const noRoute = await getJson(
      '/api/admin/analytics?view=route',
      admin.cookie,
    )
    expect(noRoute.status).toBe(422)
  })

  it('should answer the overview with its meta (any data source)', async () => {
    const admin = await platformAdmin()
    const res = await getJson(
      '/api/admin/analytics?view=overview&range=15m',
      admin.cookie,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({
      view: 'overview',
      meta: { range: '15m', bin: '30s' },
    })
    expect(['axiom', 'fixtures', 'unconfigured']).toContain(
      body.data.meta.source,
    )
    if (body.data.meta.source === 'unconfigured') {
      expect(body.data.unconfigured).toBe(true)
    } else {
      expect(body.data.series).toHaveProperty('ok')
      expect(body.data.totals).toHaveProperty('ok')
    }
  })

  it('should answer the jobs view from Redis', async () => {
    const admin = await platformAdmin()
    const res = await getJson('/api/admin/analytics?view=jobs', admin.cookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.view).toBe('jobs')
    expect(body.data.queues).toHaveProperty('ok')
    expect(body.data.failures).toHaveProperty('ok')
  })
})
