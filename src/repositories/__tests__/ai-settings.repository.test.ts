import { describe, expect, it } from 'vitest'
import { seedAiUsage } from '@/src/__tests__/factories/ai-settings.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  AiUsageRepository,
  UserAiPreferenceRepository,
  WorkspaceAiSettingsRepository,
} from '../ai-settings.repository'

describe('WorkspaceAiSettingsRepository', () => {
  it('should return null when the workspace has no settings', async () => {
    const workspace = await seedWorkspace()
    expect(
      expectOk(
        await WorkspaceAiSettingsRepository.findByWorkspace(workspace.id),
      ),
    ).toBeNull()
  })

  it('should create then update settings with DB defaults for quota and rate', async () => {
    const workspace = await seedWorkspace()

    const created = expectOk(
      await WorkspaceAiSettingsRepository.upsert(workspace.id, {
        enabledModels: ['openai:gpt-4o-mini'],
        crmAssistantModel: 'openai:gpt-4o-mini',
        whatsappReplyModel: 'openai:gpt-4o-mini',
        whatsappSentimentModel: 'openai:gpt-4o-mini',
      }),
    )
    expect(created.monthlyQuotaUsd.toNumber()).toBe(50)
    expect(created.usdPer1kTokens.toNumber()).toBe(4)

    const updated = expectOk(
      await WorkspaceAiSettingsRepository.upsert(workspace.id, {
        enabledModels: ['anthropic:claude-sonnet-5'],
        crmAssistantModel: 'anthropic:claude-sonnet-5',
        whatsappReplyModel: 'anthropic:claude-sonnet-5',
        whatsappSentimentModel: 'anthropic:claude-sonnet-5',
        monthlyQuotaUsd: 120.5,
      }),
    )
    expect(updated.id).toBe(created.id)
    expect(updated.enabledModels).toEqual(['anthropic:claude-sonnet-5'])
    expect(updated.monthlyQuotaUsd.toNumber()).toBe(120.5)
  })
})

describe('UserAiPreferenceRepository', () => {
  it('should upsert, find and remove a preference scoped by workspace', async () => {
    const [workspace, otherWorkspace, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])

    expectOk(
      await UserAiPreferenceRepository.upsert(
        workspace.id,
        user.id,
        'openai:gpt-4o-mini',
      ),
    )
    expectOk(
      await UserAiPreferenceRepository.upsert(
        workspace.id,
        user.id,
        'anthropic:claude-opus-5',
      ),
    )

    const found = expectOk(
      await UserAiPreferenceRepository.find(workspace.id, user.id),
    )
    expect(found?.modelKey).toBe('anthropic:claude-opus-5')
    expect(
      expectOk(
        await UserAiPreferenceRepository.find(otherWorkspace.id, user.id),
      ),
    ).toBeNull()

    expectOk(await UserAiPreferenceRepository.remove(workspace.id, user.id))
    expect(
      expectOk(await UserAiPreferenceRepository.find(workspace.id, user.id)),
    ).toBeNull()
  })
})

describe('AiUsageRepository', () => {
  it('should record usage and sum only the workspace rows since the given date', async () => {
    const [workspace, otherWorkspace, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const since = new Date('2026-09-01T00:00:00Z')

    expectOk(
      await AiUsageRepository.record({
        workspaceId: workspace.id,
        userId: user.id,
        feature: 'CRM_ASSISTANT',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        inputTokens: 700,
        outputTokens: 300,
        costUsd: 4,
      }),
    )
    await seedAiUsage(workspace.id, {
      feature: 'WHATSAPP_SENTIMENT',
      inputTokens: 200,
      outputTokens: 50,
      costUsd: 1,
    })
    // Mês anterior — fora do ciclo.
    await seedAiUsage(workspace.id, {
      costUsd: 100,
      createdAt: new Date('2026-08-31T23:59:59Z'),
    })
    // Outro workspace.
    await seedAiUsage(otherWorkspace.id, { costUsd: 999 })

    const totals = expectOk(
      await AiUsageRepository.sumSince(workspace.id, since),
    )
    expect(totals).toEqual({
      inputTokens: 900,
      outputTokens: 350,
      costUsd: 5,
    })
  })

  it('should return zeros when there is no usage', async () => {
    const workspace = await seedWorkspace()
    expect(
      expectOk(await AiUsageRepository.sumSince(workspace.id, new Date(0))),
    ).toEqual({ inputTokens: 0, outputTokens: 0, costUsd: 0 })
  })
})
