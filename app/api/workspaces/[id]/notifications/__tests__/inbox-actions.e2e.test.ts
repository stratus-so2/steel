import { describe, expect, it } from 'vitest'
import {
  seedSteelAgent,
  seedSteelAgentRun,
} from '@/src/__tests__/factories/steel-agent.factory'
import {
  addMember,
  authenticatedOwner,
  getJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'

const base = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/notifications`

async function seedNotifications(workspaceId: string, userId: string) {
  await prisma.notification.createMany({
    data: [
      {
        id: `n_mention_${userId}`,
        workspaceId,
        userId,
        kind: 'SD_TICKET_MENTIONED',
        title: 'Você foi mencionado',
        body: 'x',
      },
      {
        id: `n_assigned_${userId}`,
        workspaceId,
        userId,
        kind: 'CRM_LEAD_ASSIGNED',
        title: 'Lead atribuído',
        body: 'x',
        readAt: new Date(),
      },
      {
        id: `n_other_${userId}`,
        workspaceId,
        userId,
        kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
        title: 'Sentimento negativo',
        body: 'x',
        readAt: new Date(),
      },
    ],
  })
}

describe('inbox quick filters, scoped bulk actions and snooze', () => {
  it('should filter by quick filter and validate it', async () => {
    const { user, workspace } = await authenticatedOwner()
    await seedNotifications(workspace.id, user.id)

    const mentions = await getJson(
      `${base(workspace.id)}?quick=mentions`,
      user.cookie,
    )
    expect(mentions.status).toBe(200)
    const mentionsBody = await mentions.json()
    expect(
      mentionsBody.data.items.map((i: { kind: string }) => i.kind),
    ).toEqual(['SD_TICKET_MENTIONED'])

    const assigned = await getJson(
      `${base(workspace.id)}?quick=assigned&module=CRM`,
      user.cookie,
    )
    expect(
      (await assigned.json()).data.items.map((i: { kind: string }) => i.kind),
    ).toEqual(['CRM_LEAD_ASSIGNED'])

    const invalid = await getJson(
      `${base(workspace.id)}?quick=everything`,
      user.cookie,
    )
    expect(invalid.status).toBe(400)
  })

  it('should archive read ones by module and mark read by module', async () => {
    const { user, workspace } = await authenticatedOwner()
    await seedNotifications(workspace.id, user.id)

    const archived = await postJson(
      `${base(workspace.id)}/archive-read`,
      { module: 'CRM' },
      user.cookie,
    )
    expect(archived.status).toBe(200)
    expect((await archived.json()).data.updated).toBe(1)

    const read = await postJson(
      `${base(workspace.id)}/read`,
      { module: 'SERVICE_DESK' },
      user.cookie,
    )
    expect((await read.json()).data.updated).toBe(1)

    const list = await getJson(base(workspace.id), user.cookie)
    expect((await list.json()).data.counts).toEqual({
      all: 2,
      unread: 0,
      archived: 1,
      snoozed: 0,
    })

    const archiveAll = await postJson(
      `${base(workspace.id)}/archive-read`,
      {},
      user.cookie,
    )
    expect((await archiveAll.json()).data.updated).toBe(2)
  })

  it('should snooze into the snoozed folder as unread and unsnooze back', async () => {
    const { user, workspace } = await authenticatedOwner()
    await seedNotifications(workspace.id, user.id)
    const id = `n_assigned_${user.id}`

    const snoozed = await postJson(
      `${base(workspace.id)}/snooze`,
      { ids: [id], preset: 'tomorrow' },
      user.cookie,
    )
    expect(snoozed.status).toBe(200)
    const body = await snoozed.json()
    expect(body.data.updated).toBe(1)
    expect(Date.parse(body.data.snoozedUntil)).toBeGreaterThan(Date.now())

    const all = await (await getJson(base(workspace.id), user.cookie)).json()
    expect(all.data.items.map((i: { id: string }) => i.id)).not.toContain(id)
    expect(all.data.counts.snoozed).toBe(1)

    const folder = await (
      await getJson(`${base(workspace.id)}?folder=snoozed`, user.cookie)
    ).json()
    expect(folder.data.items).toHaveLength(1)
    expect(folder.data.items[0].read).toBe(false)
    expect(folder.data.items[0].snoozedUntil).toBe(body.data.snoozedUntil)

    const undo = await postJson(
      `${base(workspace.id)}/actions`,
      { action: 'unsnooze', ids: [id] },
      user.cookie,
    )
    expect((await undo.json()).data.updated).toBe(1)
    const back = await (await getJson(base(workspace.id), user.cookie)).json()
    expect(back.data.counts.snoozed).toBe(0)
  })

  it('should validate the snooze body and forbid outsiders', async () => {
    const { user, workspace } = await authenticatedOwner()
    const { user: outsider } = await authenticatedOwner()

    const invalid = await postJson(
      `${base(workspace.id)}/snooze`,
      { ids: ['x'], preset: 'forever' },
      user.cookie,
    )
    expect(invalid.status).toBe(400)

    const forbidden = await postJson(
      `${base(workspace.id)}/snooze`,
      { ids: ['x'], preset: '1h' },
      outsider.cookie,
    )
    expect(forbidden.status).toBe(403)

    const archive = await postJson(
      `${base(workspace.id)}/archive-read`,
      { module: 'NOPE' },
      user.cookie,
    )
    expect(archive.status).toBe(400)
  })
})

describe('GET/PUT /notifications/preferences/delivery', () => {
  it('should default to off, save the opt-in and validate', async () => {
    const { user, workspace } = await authenticatedOwner()
    const url = `${base(workspace.id)}/preferences/delivery`

    const initial = await getJson(url, user.cookie)
    expect(initial.status).toBe(200)
    expect((await initial.json()).data).toEqual({ browserEnabled: false })

    const saved = await putJson(url, { browserEnabled: true }, user.cookie)
    expect(saved.status).toBe(200)
    expect((await saved.json()).data).toEqual({ browserEnabled: true })

    const after = await getJson(url, user.cookie)
    expect((await after.json()).data).toEqual({ browserEnabled: true })

    const invalid = await putJson(url, { browserEnabled: 'yes' }, user.cookie)
    expect(invalid.status).toBe(400)

    const { user: outsider } = await authenticatedOwner()
    expect((await getJson(url, outsider.cookie)).status).toBe(403)
  })
})

describe('GET /notifications/ai-pending', () => {
  it('should list own assistant actions and the agent approvals the user may decide', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const soon = new Date(Date.now() + 10 * 60 * 1000)
    const later = new Date(Date.now() + 60 * 60 * 1000)

    const conversation = await prisma.aiConversation.create({
      data: { workspaceId: workspace.id, userId: member.id, title: 'Chat' },
    })
    const agent = await seedSteelAgent({
      workspaceId: workspace.id,
      ownerId: owner.id,
      name: 'Triagem',
    })
    const run = await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: agent.id,
      status: 'WAITING_APPROVAL',
    })
    const preview = { title: 'Alterar prioridade', summary: '' }
    await prisma.aiPendingAction.createMany({
      data: [
        {
          id: `pa_member_${member.id}`,
          workspaceId: workspace.id,
          requestedById: member.id,
          conversationId: conversation.id,
          toolName: 'sd_update_ticket',
          kind: 'UPDATE',
          args: {},
          preview,
          expiresAt: soon,
        },
        {
          id: `pa_expired_${member.id}`,
          workspaceId: workspace.id,
          requestedById: member.id,
          toolName: 'sd_update_ticket',
          kind: 'UPDATE',
          args: {},
          preview,
          expiresAt: new Date(Date.now() - 1000),
        },
        {
          id: `pa_agent_${run.id}`,
          workspaceId: workspace.id,
          requestedById: null,
          agentRunId: run.id,
          toolName: 'crm_delete_opportunity',
          kind: 'DELETE',
          args: {},
          preview,
          requiresDoubleConfirm: true,
          expiresAt: later,
        },
      ],
    })

    const mine = await getJson(
      `${base(workspace.id)}/ai-pending`,
      member.cookie,
    )
    expect(mine.status).toBe(200)
    const mineBody = await mine.json()
    expect(mineBody.data.count).toBe(1)
    expect(mineBody.data.items[0]).toMatchObject({
      source: 'ASSISTANT',
      path: `/ai/${conversation.id}`,
      conversation: { id: conversation.id, title: 'Chat' },
      action: { id: `pa_member_${member.id}`, status: 'PENDING' },
    })

    const ownerView = await getJson(
      `${base(workspace.id)}/ai-pending`,
      owner.cookie,
    )
    const ownerBody = await ownerView.json()
    expect(ownerBody.data.count).toBe(1)
    expect(ownerBody.data.items[0]).toMatchObject({
      source: 'AGENT',
      runId: run.id,
      agent: { id: agent.id, name: 'Triagem' },
      path: `/ai/agents/${agent.id}/runs/${run.id}`,
      action: { kind: 'DELETE', requiresDoubleConfirm: true },
    })

    const { user: outsider } = await authenticatedOwner()
    expect(
      (await getJson(`${base(workspace.id)}/ai-pending`, outsider.cookie))
        .status,
    ).toBe(403)
  })
})
