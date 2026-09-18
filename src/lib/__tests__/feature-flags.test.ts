import { describe, expect, it } from 'vitest'
import { FEATURE_KEYS } from '@/src/config/features'
import { isOverrideActive, resolveFeatureMap } from '../feature-flags'

const NOW = new Date('2026-09-18T12:00:00Z')

describe('isOverrideActive()', () => {
  it('is active without expiry or with a future expiry', () => {
    expect(isOverrideActive({ expiresAt: null }, NOW)).toBe(true)
    expect(isOverrideActive({ expiresAt: '2026-09-18T12:00:01Z' }, NOW)).toBe(
      true,
    )
  })

  it('is inactive once the expiry is reached', () => {
    expect(isOverrideActive({ expiresAt: '2026-09-18T12:00:00Z' }, NOW)).toBe(
      false,
    )
    expect(
      isOverrideActive({ expiresAt: new Date('2026-01-01T00:00:00Z') }, NOW),
    ).toBe(false)
  })
})

describe('resolveFeatureMap()', () => {
  it('returns the plan defaults for every catalog key when there is no override', () => {
    const map = resolveFeatureMap('FREE', [], NOW)
    expect(Object.keys(map).sort()).toEqual([...FEATURE_KEYS].sort())
    expect(map['crm.aiAssistant']).toBe(true)
  })

  it('applies an active override over the plan default', () => {
    const map = resolveFeatureMap(
      'ENTERPRISE',
      [{ key: 'communication.broadcasts', enabled: false, expiresAt: null }],
      NOW,
    )
    expect(map['communication.broadcasts']).toBe(false)
    expect(map['crm.socialPublishing']).toBe(true)
  })

  it('ignores an expired override', () => {
    const map = resolveFeatureMap(
      'PRO',
      [
        {
          key: 'crm.aiAssistant',
          enabled: false,
          expiresAt: '2026-09-01T00:00:00Z',
        },
      ],
      NOW,
    )
    expect(map['crm.aiAssistant']).toBe(true)
  })

  it('ignores orphan keys no longer in the catalog', () => {
    const map = resolveFeatureMap(
      'PRO',
      [{ key: 'crm.retired', enabled: true, expiresAt: null }],
      NOW,
    )
    expect(map).not.toHaveProperty('crm.retired')
  })
})
