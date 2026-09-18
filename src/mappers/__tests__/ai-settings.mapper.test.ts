import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { createFakeWorkspaceAiSettings } from '@/src/__tests__/factories/ai-settings.factory'
import { AI_MODEL_CATALOG } from '@/src/lib/ai/models'
import {
  toEffectiveAiSettings,
  toWorkspaceAiSettingsDTO,
} from '../ai-settings.mapper'

describe('toEffectiveAiSettings()', () => {
  it('should fall back to platform defaults when there is no row', () => {
    expect(toEffectiveAiSettings(null)).toEqual({
      enabledModels: AI_MODEL_CATALOG.map((m) => m.key),
      crmAssistantModel: 'openai:gpt-4o-mini',
      whatsappReplyModel: 'openai:gpt-4o-mini',
      whatsappSentimentModel: 'openai:gpt-4o-mini',
      monthlyQuotaUsd: 50,
      usdPer1kTokens: 4,
    })
  })

  it('should convert decimals and drop models no longer in the catalog', () => {
    const effective = toEffectiveAiSettings(
      createFakeWorkspaceAiSettings({
        enabledModels: ['openai:gpt-4o-mini', 'openai:retired-model'],
        crmAssistantModel: 'openai:retired-model',
        monthlyQuotaUsd: new Prisma.Decimal('120.50'),
        usdPer1kTokens: new Prisma.Decimal('4.0000'),
      }),
    )
    expect(effective.enabledModels).toEqual(['openai:gpt-4o-mini'])
    expect(effective.crmAssistantModel).toBe('openai:gpt-4o-mini')
    expect(effective.monthlyQuotaUsd).toBe(120.5)
    expect(effective.usdPer1kTokens).toBe(4)
  })
})

describe('toWorkspaceAiSettingsDTO()', () => {
  const base = {
    workspaceId: 'ws1',
    settings: toEffectiveAiSettings(
      createFakeWorkspaceAiSettings({
        enabledModels: ['openai:gpt-4o-mini', 'anthropic:claude-sonnet-5'],
      }),
    ),
    periodStart: new Date('2026-09-01T00:00:00Z'),
    userPreference: 'anthropic:claude-sonnet-5',
    canManage: false,
    isProviderAvailable: (p: string) => p === 'openai',
  }

  it('should flag provider availability and enabled models', () => {
    const dto = toWorkspaceAiSettingsDTO({
      ...base,
      usage: { inputTokens: 1000, outputTokens: 500, costUsd: 6 },
    })

    expect(dto.providers).toEqual([
      { id: 'openai', label: 'OpenAI', available: true },
      { id: 'anthropic', label: 'Anthropic (Claude)', available: false },
    ])
    const sonnet = dto.models.find((m) => m.key === 'anthropic:claude-sonnet-5')
    expect(sonnet).toEqual(
      expect.objectContaining({ available: false, enabled: true }),
    )
    const opus = dto.models.find((m) => m.key === 'anthropic:claude-opus-5')
    expect(opus?.enabled).toBe(false)
    expect(dto.userPreference).toBe('anthropic:claude-sonnet-5')
    expect(dto.canManage).toBe(false)
  })

  it('should summarize consumption against the quota', () => {
    const dto = toWorkspaceAiSettingsDTO({
      ...base,
      usage: { inputTokens: 1000, outputTokens: 500, costUsd: 6.004 },
    })
    expect(dto.usage).toEqual({
      periodStart: '2026-09-01T00:00:00.000Z',
      inputTokens: 1000,
      outputTokens: 500,
      usedUsd: 6,
      remainingUsd: 44,
      exceeded: false,
    })
  })

  it('should mark the quota as exceeded', () => {
    const dto = toWorkspaceAiSettingsDTO({
      ...base,
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 50 },
    })
    expect(dto.usage.exceeded).toBe(true)
    expect(dto.usage.remainingUsd).toBe(0)
  })
})
