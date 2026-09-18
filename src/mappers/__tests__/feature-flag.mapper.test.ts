import { describe, expect, it } from 'vitest'
import { createFakeWorkspaceFeatureOverride } from '@/src/__tests__/factories/workspace-feature-override.factory'
import { FEATURE_KEYS } from '@/src/config/features'
import { toWorkspaceFeatureDTOs } from '../feature-flag.mapper'

const NOW = new Date('2026-09-18T12:00:00Z')

describe('toWorkspaceFeatureDTOs()', () => {
  it('lists every catalog feature with its plan default and no override', () => {
    const dtos = toWorkspaceFeatureDTOs('FREE', [], NOW)

    expect(dtos.map((d) => d.key)).toEqual(FEATURE_KEYS)
    const ai = dtos.find((d) => d.key === 'crm.aiAssistant')
    expect(ai).toMatchObject({
      module: 'CRM',
      label: 'Assistente de IA do CRM',
      planDefault: true,
      override: null,
      enabled: true,
    })
  })

  it('maps an active override and uses it as the effective value', () => {
    const expiresAt = new Date('2026-12-31T00:00:00Z')
    const override = createFakeWorkspaceFeatureOverride({
      key: 'communication.broadcasts',
      enabled: false,
      note: 'Pausado a pedido do cliente',
      expiresAt,
    })

    const dto = toWorkspaceFeatureDTOs('BUSINESS', [override], NOW).find(
      (d) => d.key === 'communication.broadcasts',
    )

    expect(dto?.enabled).toBe(false)
    expect(dto?.override).toEqual({
      enabled: false,
      note: 'Pausado a pedido do cliente',
      expiresAt: expiresAt.toISOString(),
      expired: false,
      updatedById: override.updatedById,
      updatedAt: override.updatedAt.toISOString(),
    })
  })

  it('keeps an expired override visible but falls back to the plan default', () => {
    const override = createFakeWorkspaceFeatureOverride({
      key: 'crm.aiAssistant',
      enabled: false,
      expiresAt: new Date('2026-09-01T00:00:00Z'),
    })

    const dto = toWorkspaceFeatureDTOs('PRO', [override], NOW).find(
      (d) => d.key === 'crm.aiAssistant',
    )

    expect(dto?.override?.expired).toBe(true)
    expect(dto?.enabled).toBe(true)
  })

  it('drops overrides whose key left the catalog', () => {
    const dtos = toWorkspaceFeatureDTOs(
      'PRO',
      [createFakeWorkspaceFeatureOverride({ key: 'crm.retired' })],
      NOW,
    )
    expect(dtos.map((d) => d.key)).toEqual(FEATURE_KEYS)
  })
})
