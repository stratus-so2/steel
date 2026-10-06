import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

// The server and this process share the env (CI sets BILLING_ENABLED=true),
// so each state of the billing flag runs its own cases.
const BILLING_ON = process.env.BILLING_ENABLED === 'true'

// NOTE: the valid / COUPON_INVALID paths hit AbacatePay's coupon API, which
// requires a live sandbox, so only the auth and validation short-circuits
// (which run before the gateway is called) are covered here.

describe('GET /api/coupons/validate', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/coupons/validate?code=BLACKFRIDAY`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 422 when the code is missing', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await getJson('/api/coupons/validate', cookie)
    expect(res.status).toBe(422)
  })

  it('should return 422 for a malformed code', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await getJson('/api/coupons/validate?code=%20%20', cookie)
    expect(res.status).toBe(422)
  })
})

describe.runIf(!BILLING_ON)('GET /api/coupons/validate — billing off', () => {
  it('should return 503 BILLING_DISABLED for a well-formed code', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await getJson('/api/coupons/validate?code=BLACKFRIDAY', cookie)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('BILLING_DISABLED')
  })
})
