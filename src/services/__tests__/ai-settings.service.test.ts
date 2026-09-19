import { describe, expect, it, vi } from 'vitest'
import {
  createFakeUserAiPreference,
  createFakeWorkspaceAiSettings,
} from '@/src/__tests__/factories/ai-settings.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/ai-settings.repository')
vi.mock('@/src/lib/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/ai')>()
  return {
    ...actual,
    isAiProviderConfigured: vi.fn(),
    getAiProvider: vi.fn(),
  }
})

import { isAiProviderConfigured } from '@/src/lib/ai'
import {
  AiUsageRepository,
  UserAiPreferenceRepository,
  WorkspaceAiSettingsRepository,
} from '@/src/repositories/ai-settings.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { AiSettingsService } from '../ai-settings.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedSettingsRepo = vi.mocked(WorkspaceAiSettingsRepository)
const mockedPreferenceRepo = vi.mocked(UserAiPreferenceRepository)
const mockedUsageRepo = vi.mocked(AiUsageRepository)
const mockedConfigured = vi.mocked(isAiProviderConfigured)

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

function withState(options?: {
  settings?: ReturnType<typeof createFakeWorkspaceAiSettings> | null
  anthropicAvailable?: boolean
}) {
  mockedConfigured.mockImplementation(
    (provider) =>
      provider === 'openai' || (options?.anthropicAvailable ?? true),
  )
  mockedSettingsRepo.findByWorkspace.mockResolvedValue(
    ok(options?.settings === undefined ? null : options.settings),
  )
  mockedSettingsRepo.upsert.mockImplementation(async (workspaceId, data) =>
    ok(
      createFakeWorkspaceAiSettings({
        workspaceId,
        enabledModels: data.enabledModels as string[],
        crmAssistantModel: data.crmAssistantModel,
        whatsappReplyModel: data.whatsappReplyModel,
        whatsappSentimentModel: data.whatsappSentimentModel,
      }),
    ),
  )
  mockedUsageRepo.sumSince.mockResolvedValue(
    ok({ inputTokens: 0, outputTokens: 0, costUsd: 0 }),
  )
  mockedPreferenceRepo.find.mockResolvedValue(ok(null))
  mockedPreferenceRepo.upsert.mockResolvedValue(
    ok(createFakeUserAiPreference()),
  )
  mockedPreferenceRepo.remove.mockResolvedValue(ok(undefined))
}

describe('AiSettingsService', () => {
  describe('get()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await AiSettingsService.get('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should let a regular member read the settings without manage rights', async () => {
      asRole('MEMBER')
      withState({ anthropicAvailable: false })

      const dto = expectOk(await AiSettingsService.get('u1', 'ws1'))
      expect(dto.canManage).toBe(false)
      expect(dto.crmAssistantModel).toBe('openai:gpt-4o-mini')
      expect(dto.monthlyQuotaUsd).toBe(50)
      expect(dto.providers.find((p) => p.id === 'anthropic')?.available).toBe(
        false,
      )
    })

    it('should flag admins as able to manage', async () => {
      asRole('ADMIN')
      withState()
      expect(expectOk(await AiSettingsService.get('u1', 'ws1')).canManage).toBe(
        true,
      )
    })
  })

  describe('update()', () => {
    it('should return FORBIDDEN when a regular member tries to change settings', async () => {
      asRole('MEMBER')
      withState()

      expectErr(
        await AiSettingsService.update('u1', 'ws1', { monthlyQuotaUsd: 999 }),
        'FORBIDDEN',
      )
      expect(mockedSettingsRepo.upsert).not.toHaveBeenCalled()
    })

    it('should let an OWNER update models and quota', async () => {
      asRole('OWNER')
      withState()

      const dto = expectOk(
        await AiSettingsService.update('u1', 'ws1', {
          enabledModels: ['openai:gpt-4o-mini', 'anthropic:claude-sonnet-5'],
          crmAssistantModel: 'anthropic:claude-sonnet-5',
          monthlyQuotaUsd: 120,
        }),
      )
      expect(mockedSettingsRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        expect.objectContaining({
          enabledModels: ['openai:gpt-4o-mini', 'anthropic:claude-sonnet-5'],
          crmAssistantModel: 'anthropic:claude-sonnet-5',
          whatsappReplyModel: 'openai:gpt-4o-mini',
          monthlyQuotaUsd: 120,
        }),
      )
      expect(dto.canManage).toBe(true)
    })

    it('should never let the admin change the cost rate', async () => {
      asRole('ADMIN')
      withState()
      await AiSettingsService.update('u1', 'ws1', {
        // @ts-expect-error — campo fora do contrato
        usdPer1kTokens: 0,
      })
      expect(mockedSettingsRepo.upsert.mock.calls[0][1]).not.toHaveProperty(
        'usdPer1kTokens',
      )
    })

    it('should reject a feature default that is not enabled', async () => {
      asRole('ADMIN')
      withState()

      expectErr(
        await AiSettingsService.update('u1', 'ws1', {
          enabledModels: ['anthropic:claude-sonnet-5'],
        }),
        'VALIDATION_ERROR',
      )
    })

    it('should reject enabling a provider without a configured API key', async () => {
      asRole('ADMIN')
      withState({
        anthropicAvailable: false,
        settings: createFakeWorkspaceAiSettings({
          enabledModels: ['openai:gpt-4o-mini'],
        }),
      })

      expectErr(
        await AiSettingsService.update('u1', 'ws1', {
          enabledModels: ['openai:gpt-4o-mini', 'anthropic:claude-opus-5'],
        }),
        'AI_PROVIDER_UNAVAILABLE',
      )
    })
  })

  describe('setUserPreference()', () => {
    it('should save an enabled model for a regular member', async () => {
      asRole('MEMBER')
      withState({
        settings: createFakeWorkspaceAiSettings({
          enabledModels: ['openai:gpt-4o-mini', 'anthropic:claude-sonnet-5'],
        }),
      })

      expectOk(
        await AiSettingsService.setUserPreference('u1', 'ws1', {
          modelKey: 'anthropic:claude-sonnet-5',
        }),
      )
      expect(mockedPreferenceRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        'u1',
        'anthropic:claude-sonnet-5',
      )
    })

    it('should reject a model disabled in the workspace', async () => {
      asRole('MEMBER')
      withState({
        settings: createFakeWorkspaceAiSettings({
          enabledModels: ['openai:gpt-4o-mini'],
        }),
      })

      expectErr(
        await AiSettingsService.setUserPreference('u1', 'ws1', {
          modelKey: 'anthropic:claude-opus-5',
        }),
        'AI_MODEL_NOT_ENABLED',
      )
      expect(mockedPreferenceRepo.upsert).not.toHaveBeenCalled()
    })

    it('should reject an enabled model whose provider is unavailable', async () => {
      asRole('MEMBER')
      withState({
        anthropicAvailable: false,
        settings: createFakeWorkspaceAiSettings({
          enabledModels: ['openai:gpt-4o-mini', 'anthropic:claude-sonnet-5'],
        }),
      })

      expectErr(
        await AiSettingsService.setUserPreference('u1', 'ws1', {
          modelKey: 'anthropic:claude-sonnet-5',
        }),
        'AI_PROVIDER_UNAVAILABLE',
      )
    })

    it('should clear the preference with null', async () => {
      asRole('MEMBER')
      withState()

      expectOk(
        await AiSettingsService.setUserPreference('u1', 'ws1', {
          modelKey: null,
        }),
      )
      expect(mockedPreferenceRepo.remove).toHaveBeenCalledWith('ws1', 'u1')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await AiSettingsService.setUserPreference('u1', 'ws1', {
          modelKey: null,
        }),
        'FORBIDDEN',
      )
    })
  })
})

describe('AiSettingsService failure paths', () => {
  const DB_ERROR = { code: 'DATABASE_ERROR' as const, message: 'db down' }

  it('get() should propagate a settings lookup failure', async () => {
    asRole('MEMBER')
    withState()
    mockedSettingsRepo.findByWorkspace.mockResolvedValue(err(DB_ERROR))

    expectErr(await AiSettingsService.get('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('get() should propagate a usage aggregation failure', async () => {
    asRole('MEMBER')
    withState()
    mockedUsageRepo.sumSince.mockResolvedValue(err(DB_ERROR))

    expectErr(await AiSettingsService.get('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('get() should propagate a preference lookup failure', async () => {
    asRole('MEMBER')
    withState()
    mockedPreferenceRepo.find.mockResolvedValue(err(DB_ERROR))

    expectErr(await AiSettingsService.get('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it("get() should surface the member's saved preference", async () => {
    asRole('MEMBER')
    withState()
    mockedPreferenceRepo.find.mockResolvedValue(
      ok(createFakeUserAiPreference({ modelKey: 'openai:gpt-4o-mini' })),
    )

    const dto = expectOk(await AiSettingsService.get('u1', 'ws1'))

    expect(dto.userPreference).toBe('openai:gpt-4o-mini')
  })

  it('update() should propagate a settings lookup failure', async () => {
    asRole('OWNER')
    withState()
    mockedSettingsRepo.findByWorkspace.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AiSettingsService.update('u1', 'ws1', { monthlyQuotaUsd: 10 }),
      'DATABASE_ERROR',
    )
  })

  it('update() should change the WhatsApp reply and sentiment defaults', async () => {
    asRole('OWNER')
    withState()

    expectOk(
      await AiSettingsService.update('u1', 'ws1', {
        enabledModels: ['openai:gpt-4o-mini', 'openai:gpt-5-mini'],
        whatsappReplyModel: 'openai:gpt-5-mini',
        whatsappSentimentModel: 'openai:gpt-5-mini',
      }),
    )

    expect(mockedSettingsRepo.upsert).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({
        whatsappReplyModel: 'openai:gpt-5-mini',
        whatsappSentimentModel: 'openai:gpt-5-mini',
      }),
    )
  })

  it('update() should propagate a save failure', async () => {
    asRole('OWNER')
    withState()
    mockedSettingsRepo.upsert.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AiSettingsService.update('u1', 'ws1', { monthlyQuotaUsd: 10 }),
      'DATABASE_ERROR',
    )
  })

  it('setUserPreference() should propagate a settings lookup failure', async () => {
    asRole('MEMBER')
    withState()
    mockedSettingsRepo.findByWorkspace.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AiSettingsService.setUserPreference('u1', 'ws1', {
        modelKey: null,
      }),
      'DATABASE_ERROR',
    )
  })

  it('setUserPreference() should propagate a removal failure', async () => {
    asRole('MEMBER')
    withState()
    mockedPreferenceRepo.remove.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AiSettingsService.setUserPreference('u1', 'ws1', {
        modelKey: null,
      }),
      'DATABASE_ERROR',
    )
  })

  it('setUserPreference() should propagate a save failure', async () => {
    asRole('MEMBER')
    withState()
    mockedPreferenceRepo.upsert.mockResolvedValue(err(DB_ERROR))

    expectErr(
      await AiSettingsService.setUserPreference('u1', 'ws1', {
        modelKey: 'openai:gpt-4o-mini',
      }),
      'DATABASE_ERROR',
    )
  })
})
