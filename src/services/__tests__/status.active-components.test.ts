import { describe, expect, it, vi } from 'vitest'

vi.mock('@/src/lib/billing', () => ({ isBillingEnabled: vi.fn() }))

import { isBillingEnabled } from '@/src/lib/billing'
import { activeComponents } from '@/src/services/status/active-components'
import { COMPONENTS } from '@/src/services/status/components'

describe('activeComponents()', () => {
  it('returns the full catalog while billing is on', () => {
    vi.mocked(isBillingEnabled).mockReturnValue(true)

    expect(activeComponents()).toBe(COMPONENTS)
  })

  it('drops only the payment component while billing is off', () => {
    vi.mocked(isBillingEnabled).mockReturnValue(false)

    expect(activeComponents().map((c) => c.key)).toEqual([
      'app',
      'database',
      'cache',
      'auth',
      'email',
      'storage',
    ])
  })
})
