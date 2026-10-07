import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  createFakeUserAiPreference,
  createFakeWorkspaceAiSettings,
} from '@/src/__tests__/factories/ai-settings.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/platform-notifications')
vi.mock('@/src/services/platform-ai-settings.service', () => ({
  PlatformAiSettingsService: { getCostMargin: vi.fn() },
}))
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
import { PlatformAiSettingsService } from '../platform-ai-settings.service'
import { notifyAiQuota } from '../platform-notifications'

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
  margin?: number
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
  vi.mocked(PlatformAiSettingsService.getCostMargin).mockResolvedValue(
    options.margin ?? 1,
  )
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
    expect(call.costMargin).toBe(1)
    expect(call).not.toHaveProperty('usdPer1kTokens')
  })

  it('should prefer the user choice on the CRM assistant', async () => {
    setup({ settings, preference: 'anthropic:claude-sonnet-5' })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
    )
    expect(call.model.key).toBe('anthropic:claude-sonnet-5')
    expect(call.provider.id).toBe('anthropic')
  })

  it('should prefer the user choice on the Steel AI assistant', async () => {
    setup({ settings, preference: 'anthropic:claude-sonnet-5' })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'STEEL_ASSISTANT', 'u1'),
    )
    expect(call.feature).toBe('STEEL_ASSISTANT')
    expect(call.model.key).toBe('anthropic:claude-sonnet-5')
  })

  it('should not apply the user choice to Steel Agents', async () => {
    setup({ settings, preference: 'anthropic:claude-sonnet-5' })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'STEEL_AGENT', 'u1'),
    )
    expect(call.model.key).toBe('openai:gpt-4o-mini')
    expect(mockedPreferenceRepo.find).not.toHaveBeenCalled()
  })

  it('resolveModel() should return null when no model is usable', async () => {
    setup({
      settings: createFakeWorkspaceAiSettings({
        enabledModels: ['anthropic:claude-sonnet-5'],
        crmAssistantModel: 'anthropic:claude-sonnet-5',
      }),
      anthropicAvailable: false,
    })
    const resolved = expectOk(
      await AiUsageService.resolveModel('ws1', 'STEEL_ASSISTANT', 'u1'),
    )
    expect(resolved.model).toBeNull()
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
  it('should freeze the real model price on the ledger', async () => {
    setup({ settings })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
    )

    await AiUsageService.record(call, {
      workspaceId: 'ws1',
      userId: 'u1',
      usage: { inputTokens: 800_000, outputTokens: 200_000 },
    })

    // gpt-4o-mini: 0.8M × US$ 0.15 + 0.2M × US$ 0.60
    expect(mockedUsageRepo.record).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      userId: 'u1',
      feature: 'CRM_ASSISTANT',
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 800_000,
      outputTokens: 200_000,
      costUsd: 0.24,
    })
  })

  it('should price usage with the same rule as the ledger', async () => {
    setup({ settings })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
    )
    expect(
      AiUsageService.price(call, {
        inputTokens: 800_000,
        outputTokens: 200_000,
      }),
    ).toBe(0.24)
    expect(
      AiUsageService.price(
        { ...call, costMargin: undefined },
        { inputTokens: 800_000, outputTokens: 200_000 },
      ),
    ).toBe(0.24)
  })

  it('should apply the platform margin read at prepare time', async () => {
    setup({ settings, margin: 2 })
    const call = expectOk(await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'))
    expect(call.costMargin).toBe(2)

    await AiUsageService.record(call, {
      workspaceId: 'ws1',
      userId: null,
      usage: {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 1_000_000,
      },
    })
    // Haiku 4.5, all input from cache: 1M × US$ 0.10 × 2
    expect(mockedUsageRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-haiku-4-5', costUsd: 0.2 }),
    )
  })

  it('should price a hand-built call at cost, and an unknown model at the fallback', async () => {
    setup({ settings })
    const provider = { id: 'openai', chat: vi.fn() } as unknown as AiProvider
    await AiUsageService.record(
      {
        feature: 'CRM_ASSISTANT',
        provider,
        model: {
          key: 'openai:retired',
          provider: 'openai',
          model: 'retired',
          label: 'Retired',
        },
        usdPer1kTokens: 4,
      },
      {
        workspaceId: 'ws1',
        userId: null,
        usage: { inputTokens: 1_000_000, outputTokens: 0 },
      },
    )
    // Most expensive catalog input price (Claude Opus 5), margin 1.
    expect(mockedUsageRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'retired', costUsd: 5 }),
    )
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

describe('AiUsageService edge cases', () => {
  it('prepare() should propagate a settings lookup failure', async () => {
    setup({ settings })
    mockedSettingsRepo.findByWorkspace.mockResolvedValue(err(databaseError()))

    expectErr(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
      'DATABASE_ERROR',
    )
    expect(mockedPreferenceRepo.find).not.toHaveBeenCalled()
  })

  it('prepare() should propagate a preference lookup failure', async () => {
    setup({ settings })
    mockedPreferenceRepo.find.mockResolvedValue(err(databaseError()))

    expectErr(
      await AiUsageService.prepare('ws1', 'CRM_ASSISTANT', 'u1'),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['no tokens at all', { inputTokens: 0, outputTokens: 0 }, false],
    ['only output tokens', { inputTokens: 0, outputTokens: 50 }, true],
  ])(
    'record() with %s should write to the ledger: %s',
    async (_label, usage, written) => {
      setup({ settings })
      const call = expectOk(
        await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'),
      )

      await AiUsageService.record(call, {
        workspaceId: 'ws1',
        userId: null,
        usage,
      })

      expect(mockedUsageRepo.record).toHaveBeenCalledTimes(written ? 1 : 0)
    },
  )
})

describe('AiUsageService.record() quota notifications', () => {
  const mockedNotifyQuota = vi.mocked(notifyAiQuota)
  const usage = { inputTokens: 10, outputTokens: 10 }

  async function recordWithUsed(usedUsd: number, quota = 50) {
    setup({ settings })
    const call = expectOk(await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'))
    mockedUsageRepo.sumSince.mockResolvedValue(
      ok({ inputTokens: 0, outputTokens: 0, costUsd: usedUsd }),
    )
    mockedNotifyQuota.mockClear()
    await AiUsageService.record(
      { ...call, monthlyQuotaUsd: quota },
      { workspaceId: 'ws1', userId: null, usage },
    )
  }

  it('should carry the workspace quota on the prepared call', async () => {
    setup({ settings })
    const call = expectOk(await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'))
    expect(call.monthlyQuotaUsd).toBe(50)
  })

  it('should warn the admins once the month reaches 80% of the quota', async () => {
    await recordWithUsed(40)
    expect(mockedNotifyQuota).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      threshold: 'warning',
      period: expect.stringMatching(/^\d{4}-\d{2}$/),
    })
  })

  it('should report the quota as exhausted at 100%', async () => {
    await recordWithUsed(50)
    expect(mockedNotifyQuota).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: 'exceeded' }),
    )
  })

  it('should stay quiet below 80%', async () => {
    await recordWithUsed(39.99)
    expect(mockedNotifyQuota).not.toHaveBeenCalled()
  })

  it('should skip the check without a quota or when the usage sum fails', async () => {
    await recordWithUsed(100, 0)
    expect(mockedNotifyQuota).not.toHaveBeenCalled()

    setup({ settings })
    const call = expectOk(await AiUsageService.prepare('ws1', 'WHATSAPP_REPLY'))
    mockedUsageRepo.sumSince.mockResolvedValue(err(databaseError()))
    await AiUsageService.record(call, {
      workspaceId: 'ws1',
      userId: null,
      usage,
    })
    expect(mockedNotifyQuota).not.toHaveBeenCalled()
  })
})

describe('AiUsageService — Steel AI 2 model pick and usage scope', () => {
  it('should try the conversation pick before the user preference', async () => {
    setup({ settings, preference: 'anthropic:claude-sonnet-5' })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'STEEL_ASSISTANT', 'u1', [
        undefined,
        'anthropic:claude-haiku-4-5',
      ]),
    )
    expect(call.model.key).toBe('anthropic:claude-haiku-4-5')
  })

  it('should fall back when the picked model is no longer usable', async () => {
    setup({ settings, preference: 'anthropic:claude-sonnet-5' })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'STEEL_ASSISTANT', 'u1', [
        'openai:gpt-5',
        null,
      ]),
    )
    expect(call.model.key).toBe('anthropic:claude-sonnet-5')
  })

  it('should record the usage scope when given', async () => {
    setup({ settings })
    const call = expectOk(
      await AiUsageService.prepare('ws1', 'STEEL_ASSISTANT', 'u1'),
    )
    await AiUsageService.record(call, {
      workspaceId: 'ws1',
      userId: 'u1',
      usage: { inputTokens: 10, outputTokens: 5 },
      scope: { module: 'CRM', conversationId: 'conv1' },
    })
    expect(mockedUsageRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'CRM',
        conversationId: 'conv1',
        agentRunId: null,
      }),
    )

    await AiUsageService.record(call, {
      workspaceId: 'ws1',
      userId: 'u1',
      usage: { inputTokens: 10, outputTokens: 5 },
      scope: {},
    })
    expect(mockedUsageRepo.record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        module: null,
        conversationId: null,
        agentRunId: null,
      }),
    )
  })
})
