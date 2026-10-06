import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

// The server and this process share the env (CI sets BILLING_ENABLED=true),
// so each state of the billing flag runs its own cases.
const BILLING_ON = process.env.BILLING_ENABLED === 'true'

// NOTE: success path (201 with subscription created) is intentionally NOT
// tested here because it would require either a live AbacatePay sandbox or
// patching `lib/abacatepay.ts` to support a configurable base URL pointing to
// a mock server. The auth/RBAC/validation paths below all short-circuit
// before AbacatePay is invoked.

describe('POST /api/payment/plan', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/payment/plan`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({
        plan: 'PRO',
        workspaceId: 'ws-x',
        seats: 1,
        interval: 'monthly',
      }),
    })
    expect(res.status).toBe(401)
  })

  it('should return 422 when plan is missing', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await postJson(
      '/api/payment/plan',
      { workspaceId: 'ws-x' },
      cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should return 422 for unknown plan', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await postJson(
      '/api/payment/plan',
      { plan: 'GOD_MODE', workspaceId: 'ws-x' },
      cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should return 422 for FREE plan (not purchasable)', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await postJson(
      '/api/payment/plan',
      { plan: 'FREE', workspaceId: 'ws-x' },
      cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should return 422 when workspaceId is empty', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await postJson(
      '/api/payment/plan',
      { plan: 'PRO', workspaceId: '' },
      cookie,
    )
    expect(res.status).toBe(422)
  })
})

describe.runIf(BILLING_ON)('POST /api/payment/plan — billing on', () => {
  it('should return 403 when user is not a member of workspace', async () => {
    const [{ workspace }, stranger] = await Promise.all([
      authenticatedOwner(),
      createAuthenticatedUser(),
    ])

    const res = await postJson(
      '/api/payment/plan',
      { plan: 'PRO', workspaceId: workspace.id, seats: 1, interval: 'monthly' },
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should return 403 when caller is MEMBER (not OWNER/ADMIN)', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await postJson(
      '/api/payment/plan',
      { plan: 'PRO', workspaceId: workspace.id, seats: 1, interval: 'monthly' },
      member.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should return 403 when caller is VIEWER', async () => {
    const { workspace } = await authenticatedOwner()
    const viewer = await addMember(workspace.id, 'VIEWER')

    const res = await postJson(
      '/api/payment/plan',
      { plan: 'PRO', workspaceId: workspace.id, seats: 1, interval: 'monthly' },
      viewer.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe.runIf(!BILLING_ON)('POST /api/payment/plan — billing off', () => {
  it('should return 503 BILLING_DISABLED even for the OWNER', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      '/api/payment/plan',
      { plan: 'PRO', workspaceId: workspace.id, seats: 1, interval: 'monthly' },
      user.cookie,
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('BILLING_DISABLED')
  })
})
