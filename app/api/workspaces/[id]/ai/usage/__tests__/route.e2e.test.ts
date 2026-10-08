import { describe, expect, it } from 'vitest'
import { seedAiUsage } from '@/src/__tests__/factories/ai-settings.factory'
import {
  addMember,
  authenticatedOwner,
  getJson,
} from '@/src/__tests__/helpers/e2e'

describe('Steel AI usage routes', () => {
  it('returns the personal overview to a member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    await seedAiUsage(workspace.id, { userId: member.id, costUsd: 1.25 })
    await seedAiUsage(workspace.id, { userId: null, costUsd: 0.75 })

    const res = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage`,
      member.cookie,
    )
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.timezone).toBe('UTC')
    expect(data.monthlyQuotaUsd).toBe(50)
    expect(data.month.mineUsd).toBe(1.25)
    expect(data.month.workspaceUsd).toBe(2)
    expect(data.canViewWorkspace).toBe(false)
  })

  it('forbids a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const { user: stranger } = await authenticatedOwner()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('returns personal analytics and keeps the workspace view for admins', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    await seedAiUsage(workspace.id, {
      userId: member.id,
      feature: 'STEEL_ASSISTANT',
      module: 'SERVICE_DESK',
      costUsd: 2,
    })
    await seedAiUsage(workspace.id, { userId: user.id, costUsd: 3 })

    const personal = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/analytics?period=last_7_days`,
      member.cookie,
    )
    expect(personal.status).toBe(200)
    const mine = (await personal.json()).data
    expect(mine.totals.costUsd).toBe(2)
    expect(mine.byModule[0].key).toBe('SERVICE_DESK')
    expect(mine.byUser).toBeNull()

    const forbidden = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/analytics?scope=workspace`,
      member.cookie,
    )
    expect(forbidden.status).toBe(403)

    const all = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/analytics?scope=workspace`,
      user.cookie,
    )
    expect(all.status).toBe(200)
    const data = (await all.json()).data
    expect(data.totals.costUsd).toBe(5)
    expect(data.byUser).toHaveLength(2)
  })

  it('rejects an invalid period', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/analytics?period=custom&from=2026-10-05&to=2026-10-01`,
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('streams the CSV of the ledger rows and the aggregates', async () => {
    const { user, workspace } = await authenticatedOwner()
    await seedAiUsage(workspace.id, {
      userId: user.id,
      feature: 'WHATSAPP_REPLY',
      costUsd: 0.5,
    })

    const rows = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/export?scope=workspace&view=rows`,
      user.cookie,
    )
    expect(rows.status).toBe(200)
    expect(rows.headers.get('content-type')).toContain('text/csv')
    expect(rows.headers.get('content-disposition')).toContain(
      'steel-ai-uso-workspace-rows-',
    )
    const csv = await rows.text()
    const lines = csv.trim().split('\r\n')
    expect(lines[0].replace('﻿', '')).toBe(
      'data_utc,usuario,email,recurso,codigo_recurso,provedor,modelo,escopo,tokens_entrada,tokens_saida,custo_usd',
    )
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('Resposta automática do WhatsApp')
    expect(lines[1]).toContain('Comunicação')

    const byUser = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/export?scope=workspace&view=user`,
      user.cookie,
    )
    expect(byUser.status).toBe(200)
    expect(await byUser.text()).toContain(`${user.id},`)
  })

  it('refuses the per-user CSV in the personal scope and the workspace CSV to a member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')

    const personalUser = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/export?view=user`,
      member.cookie,
    )
    expect(personalUser.status).toBe(422)

    const workspaceRows = await getJson(
      `/api/workspaces/${workspace.id}/ai/usage/export?scope=workspace`,
      member.cookie,
    )
    expect(workspaceRows.status).toBe(403)
  })
})
