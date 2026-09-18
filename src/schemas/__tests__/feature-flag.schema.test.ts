import { describe, expect, it } from 'vitest'
import {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  isFeatureKey,
} from '@/src/config/features'
import {
  FeatureKeySchema,
  SetFeatureOverrideSchema,
} from '../feature-flag.schema'

const future = () => new Date(Date.now() + 86_400_000).toISOString()

describe('FEATURE_CATALOG', () => {
  it('defines a default for every plan on every feature', () => {
    for (const key of FEATURE_KEYS) {
      expect(Object.keys(FEATURE_CATALOG[key].planDefaults).sort()).toEqual([
        'BUSINESS',
        'ENTERPRISE',
        'FREE',
        'PRO',
      ])
    }
  })

  it('prefixes each key with its module namespace', () => {
    const prefix = {
      CRM: 'crm.',
      COMMUNICATION: 'communication.',
      SERVICE_DESK: 'serviceDesk.',
    }
    for (const key of FEATURE_KEYS) {
      expect(key.startsWith(prefix[FEATURE_CATALOG[key].module])).toBe(true)
    }
  })

  it('isFeatureKey() accepts catalog keys only', () => {
    expect(isFeatureKey('crm.aiAssistant')).toBe(true)
    expect(isFeatureKey('crm.unknown')).toBe(false)
    expect(isFeatureKey('toString')).toBe(false)
  })
})

describe('FeatureKeySchema', () => {
  it('rejects keys outside the catalog', () => {
    expect(FeatureKeySchema.safeParse('crm.aiAssistant').success).toBe(true)
    expect(FeatureKeySchema.safeParse('crm.nope').success).toBe(false)
  })
})

describe('SetFeatureOverrideSchema', () => {
  it('accepts an override with note and future expiry', () => {
    const expiresAt = future()
    const result = SetFeatureOverrideSchema.safeParse({
      key: 'communication.broadcasts',
      enabled: false,
      note: '  Cliente pediu pausa  ',
      expiresAt,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.note).toBe('Cliente pediu pausa')
    expect(result.data.expiresAt?.toISOString()).toBe(expiresAt)
  })

  it('accepts enabled=null to clear the override', () => {
    const result = SetFeatureOverrideSchema.safeParse({
      key: 'crm.aiAssistant',
      enabled: null,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.note).toBeNull()
    expect(result.data.expiresAt).toBeNull()
  })

  it('normalizes a blank note to null', () => {
    const result = SetFeatureOverrideSchema.safeParse({
      key: 'crm.aiAssistant',
      enabled: true,
      note: '   ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.note).toBeNull()
  })

  it('rejects an expiry in the past', () => {
    const result = SetFeatureOverrideSchema.safeParse({
      key: 'crm.aiAssistant',
      enabled: true,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects a note over 500 chars and a missing enabled', () => {
    expect(
      SetFeatureOverrideSchema.safeParse({
        key: 'crm.aiAssistant',
        enabled: true,
        note: 'x'.repeat(501),
      }).success,
    ).toBe(false)
    expect(
      SetFeatureOverrideSchema.safeParse({ key: 'crm.aiAssistant' }).success,
    ).toBe(false)
  })
})
