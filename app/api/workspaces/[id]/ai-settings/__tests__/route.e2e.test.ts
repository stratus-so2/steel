import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  getJson,
  patchJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'

describe('Workspace AI settings', () => {
  it('should return platform defaults (gpt-4o-mini, US$ 50/month) to a member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const res = await getJson(
      `/api/workspaces/${workspace.id}/ai-settings`,
      member.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual(
      expect.objectContaining({
        crmAssistantModel: 'openai:gpt-4o-mini',
        monthlyQuotaUsd: 50,
        usdPer1kTokens: 4,
        canManage: false,
        userPreference: null,
      }),
    )
    expect(body.data.usage.usedUsd).toBe(0)
  })

  it('should let the owner change the quota and forbid a plain member', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const forbidden = await patchJson(
      `/api/workspaces/${workspace.id}/ai-settings`,
      { monthlyQuotaUsd: 999 },
      member.cookie,
    )
    expect(forbidden.status).toBe(403)

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/ai-settings`,
      { monthlyQuotaUsd: 120 },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    expect((await updated.json()).data.monthlyQuotaUsd).toBe(120)
  })

  it('should reject an invalid payload', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await patchJson(
      `/api/workspaces/${workspace.id}/ai-settings`,
      { monthlyQuotaUsd: -5 },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should refuse a personal model that is disabled in the workspace', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    await patchJson(
      `/api/workspaces/${workspace.id}/ai-settings`,
      { enabledModels: ['openai:gpt-4o-mini'] },
      user.cookie,
    )

    const res = await putJson(
      `/api/workspaces/${workspace.id}/ai-settings/preference`,
      { modelKey: 'openai:gpt-5' },
      member.cookie,
    )
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('AI_MODEL_NOT_ENABLED')
  })
})
