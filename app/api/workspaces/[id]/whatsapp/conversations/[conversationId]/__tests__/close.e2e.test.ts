import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  defaultHeaders,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

let counter = 0
function suffix() {
  counter += 1
  return `${Date.now()}${counter}`
}

async function seedConversation(workspaceId: string, userId: string) {
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId,
      provider: 'ZAPI',
      label: 'Principal',
      phoneNumber: `5511${suffix()}`,
      zapiInstanceId: `inst-${suffix()}`,
      encryptedZapiToken: 'enc:token',
      createdById: userId,
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: { workspaceId, waId: `5511${suffix()}`, name: 'Maria' },
  })
  return prisma.whatsAppConversation.create({
    data: {
      workspaceId,
      connectionId: connection.id,
      contactId: contact.id,
      status: 'IN_PROGRESS',
      assignedUserId: userId,
    },
  })
}

describe('POST /api/workspaces/[id]/whatsapp/conversations/[conversationId]/close|reopen', () => {
  it('should close with a reason, list it under CLOSED and reopen it', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await seedConversation(workspace.id, user.id)
    const base = `/api/workspaces/${workspace.id}/whatsapp/conversations`

    const closed = await postJson(
      `${base}/${conversation.id}/close`,
      { reason: 'Atendimento concluído' },
      user.cookie,
    )
    expect(closed.status).toBe(200)
    const closedBody = await closed.json()
    expect(closedBody.data.status).toBe('CLOSED')
    expect(closedBody.data.closeReason).toBe('Atendimento concluído')

    const open = await getJson(`${base}?status=OPEN`, user.cookie)
    expect((await open.json()).data).toEqual([])
    const closedList = await getJson(`${base}?status=CLOSED`, user.cookie)
    expect((await closedList.json()).data).toHaveLength(1)

    const again = await postJson(
      `${base}/${conversation.id}/close`,
      {},
      user.cookie,
    )
    expect(again.status).toBe(409)

    const reopened = await postJson(
      `${base}/${conversation.id}/reopen`,
      {},
      user.cookie,
    )
    expect(reopened.status).toBe(200)
    expect((await reopened.json()).data.status).toBe('IN_PROGRESS')

    const events = await getJson(
      `${base}/${conversation.id}/events`,
      user.cookie,
    )
    const eventsBody = await events.json()
    expect(eventsBody.data.map((e: { kind: string }) => e.kind)).toEqual([
      'CLOSED',
      'REOPENED',
    ])
  })

  it('should reject a malformed JSON body with 422 without closing', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await seedConversation(workspace.id, user.id)
    const url = `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/conversations/${conversation.id}/close`

    const res = await fetch(url, {
      method: 'POST',
      headers: { ...defaultHeaders, Cookie: user.cookie },
      body: '{"reason":',
    })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')

    const stored = await prisma.whatsAppConversation.findUniqueOrThrow({
      where: { id: conversation.id },
    })
    expect(stored.status).toBe('IN_PROGRESS')
  })

  it('should still accept an empty body (reason is optional)', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await seedConversation(workspace.id, user.id)
    const url = `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/conversations/${conversation.id}/close`

    const res = await fetch(url, {
      method: 'POST',
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })
    expect(res.status).toBe(200)
    expect((await res.json()).data.status).toBe('CLOSED')
  })

  it('should forbid a VIEWER from closing', async () => {
    const { user, workspace } = await authenticatedOwner()
    const conversation = await seedConversation(workspace.id, user.id)
    const viewer = await addMember(workspace.id, 'VIEWER')

    const res = await postJson(
      `/api/workspaces/${workspace.id}/whatsapp/conversations/${conversation.id}/close`,
      {},
      viewer.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('GET|PATCH /api/workspaces/[id]/whatsapp/settings', () => {
  it('should return the 24h default and let an owner turn auto-close off', async () => {
    const { user, workspace } = await authenticatedOwner()
    const path = `/api/workspaces/${workspace.id}/whatsapp/settings`

    const initial = await getJson(path, user.cookie)
    expect((await initial.json()).data.autoCloseAfterHours).toBe(24)

    const saved = await patchJson(path, { autoCloseAfterHours: 0 }, user.cookie)
    expect(saved.status).toBe(200)
    expect((await saved.json()).data.autoCloseAfterHours).toBe(0)
  })

  it('should reject an invalid window and forbid members', async () => {
    const { user, workspace } = await authenticatedOwner()
    const path = `/api/workspaces/${workspace.id}/whatsapp/settings`

    const invalid = await patchJson(
      path,
      { autoCloseAfterHours: -1 },
      user.cookie,
    )
    expect(invalid.status).toBe(422)

    const member = await addMember(workspace.id, 'MEMBER')
    const forbidden = await getJson(path, member.cookie)
    expect(forbidden.status).toBe(403)
  })
})
