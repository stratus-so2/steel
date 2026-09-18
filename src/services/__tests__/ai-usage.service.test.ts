import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  createFakeUserAiPreference,
  createFakeWorkspaceAiSettings,
} from '@/src/__tests__/factories/ai-settings.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/ai-settings.repository')
vi.mock('@/src/lib/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/ai')>()
  return {
    ...actual,
    isAiProviderConfigured: vi.fn(),
    getAiProvider: vi.fn(),
  }
})

import { databaseError } from '@/src/errors'
import {
  type AiProvider,
  getAiProvider,
  isAiProviderConfigured,
} from '@/src/lib/ai'
import {
  AiUsageRepository,
  UserAiPreferenceRepository,
  WorkspaceAiSettingsRepository,
} from '@/src/repositories/ai-settings.repository'
import { AiUsageService } from '../ai-usage.service'

const mockedSettingsRepo = vi.mocked(WorkspaceAiSettingsRepository)
const mockedPreferenceRepo = vi.mocked(UserAiPreferenceRepository)
const mockedUsageRepo = vi.mocked(AiUsageRepository)
const mockedConfigured = vi.mocked(isAiProviderConfigured)
const mockedGetProvider = vi.mocked(getAiProvider)

function setup(options: {
  settings?: ReturnType<typeof createFakeWorkspaceAiSettings> | null
  preference?: string | null
  usedUsd?: number
  anthropicAvailable?: boolean
  openaiAvailable?: boolean
}) {
  const available = (provider: string) =>
    provider === 'openai'
      ? (options.openaiAvailable ?? true)
      : (options.anthropicAvailable ?? true)
  mockedConfigured.mockImplementation(available)
  mockedGetProvider.mockImplementation((provider) =>
    available(provider)
      ? ({ id: provider, chat: vi.fn() } as unknown as AiProvider)
      : null,
  )
  mockedSettingsRepo.findByWorkspace.mockResolvedValue(
    ok(options.settings ?? null),
  )
  mockedPreferenceRepo.find.mockResolvedValue(
    ok(
      options.preference
        ? createFakeUserAiPreference({ modelKey: options.preference })
        : null,
    ),
  )
  mockedUsageRepo.sumSince.mockResolvedValue(
    ok({ inputTokens: 0, outputTokens: 0, costUsd: options.usedUsd ?? 0 }),
  )
  mockedUsageRepo.record.mockResolvedValue(ok(undefined))
}

const settings = createFakeWorkspaceAiSettings({
  enabledModels: [
    'openai:gpt-4o-mini',
    'anthropic:claude-sonnet-5',
    'anthropic:claude-haiku-4-5',
  ],
  crmAssistantModel: 'openai:gpt-4o-mini',
  whatsappReplyModel: 'anthropic:claude-haiku-4-5',
  whatsappSentimentModel: 'openai:gpt-4o-mini',
  monthlyQuotaUsd: new Prisma.Decimal(50),
})

describe('AiUsageService.prepare()', () => {
  it('should use the platform default (gpt-4o-mini) without settings', async () => {
    setup({})
    const call = expectOk(await AiUsageService.prepare('ws1', 'CRM_ASSISTANT'))
    expect(call.model.key).toBe('openai:gpt-4o-mini')
    expect(call.usdPer1kTokens).toBe(4)
  })

  it('should prefer the user choice on the CRM assistant', async () => {
    setup({ settings, preference: 'anthropic:claude-sonnet-5' })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
    )
    expect(call.model.key).toBe('anthropic:claude-sonnet-5')
    expect(call.provider.id).toBe('anthropic')
  })

  it('should ignore a user choice that is no longer enabled', async () => {
    setup({ settings, preference: 'anthropic:claude-opus-5' })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
    )
    expect(call.model.key).toBe('openai:gpt-4o-mini')
  })

  it('should use the workspace default for background features', async () => {
    setup({ settings })
    const call = expectOk(await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'))
    expect(call.model.key).toBe('anthropic:claude-haiku-4-5')
    expect(mockedPreferenceRepo.find).not.toHaveBeenCalled()
  })

  it('should fall back to another enabled model when the default provider has no key', async () => {
    setup({ settings, anthropicAvailable: false })
    const call = expectOk(await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'))
    expect(call.model.key).toBe('openai:gpt-4o-mini')
  })

  it('should return AI_PROVIDER_UNAVAILABLE when no enabled provider is configured', async () => {
    setup({ settings, anthropicAvailable: false, openaiAvailable: false })
    expectErr(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT'),
      'AI_PROVIDER_UNAVAILABLE',
    )
  })

  it('should block with AI_QUOTA_EXCEEDED once the monthly quota is used', async () => {
    setup({ settings, usedUsd: 50 })
    const error = expectErr(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT'),
      'AI_QUOTA_EXCEEDED',
    )
    expect(error.details).toEqual({ usedUsd: 50, quotaUsd: 50 })
    expect(error.message).toContain('cota mensal de IA')
  })

  it('should allow a call just below the quota', async () => {
    setup({ settings, usedUsd: 49.99 })
    expectOk(await AiUsageService.prepare('ws1', 'CRM_ASSISTANT'))
  })

  it('should propagate a database error', async () => {
    setup({ settings })
    mockedUsageRepo.sumSince.mockResolvedValue(err(databaseError()))
    expectErr(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT'),
      'DATABASE_ERROR',
    )
  })
})

describe('AiUsageService.record()', () => {
  it('should charge 1000 tokens as US$ 4.00 on the ledger', async () => {
    setup({ settings })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
    )

    await AiUsageService.record(call, {
      workspaceId: 'ws1',
      userId: 'u1',
      usage: { inputTokens: 800, outputTokens: 200 },
    })

    expect(mockedUsageRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userId: 'u1',
      feature: 'CRM_ASSISTANT',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 800,
      outputTokens: 200,
      costUsd: 4,
    })
  })

  it('should not throw when the ledger write fails', async () => {
    setup({ settings })
    const call = expectOk(await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'))
    mockedUsageRepo.record.mockResolvedValue(err(databaseError()))

    await expect(
      AiUsageService.record(call, {
        workspaceId: 'ws1',
        userId: null,
        usage: { inputTokens: 1, outputTokens: 1 },
      }),
    ).resolves.toBeUndefined()
  })
})
