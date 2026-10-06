import { afterEach, describe, expect, it, vi } from 'vitest'

const env = vi.hoisted(() => ({ BILLING_ENABLED: undefined as unknown }))

vi.mock('@/lib/env/server', () => ({
  get BILLING_ENABLED() {
    return env.BILLING_ENABLED
  },
}))

import { isBillingEnabled } from '@/src/lib/billing'

afterEach(() => {
  env.BILLING_ENABLED = undefined
})

describe('isBillingEnabled()', () => {
  it('is off by default (flag unset)', () => {
    expect(isBillingEnabled()).toBe(false)
  })

  it.each(['false', '', 'TRUE', '1'])(
    'stays off for %j — only the literal "true" turns it on',
    (value) => {
      env.BILLING_ENABLED = value
      expect(isBillingEnabled()).toBe(false)
    },
  )

  it('is on for "true"', () => {
    env.BILLING_ENABLED = 'true'
    expect(isBillingEnabled()).toBe(true)
  })
})
