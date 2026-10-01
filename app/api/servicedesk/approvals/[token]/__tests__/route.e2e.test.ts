import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  setupTabs,
  tabApi,
} from '@/app/api/workspaces/[id]/servicedesk/tickets/[ticketId]/__tests__/sd-tab-e2e.helpers'
import { defaultHeaders, postJson } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const publicUrl = (token: string) =>
  `${BASE_URL}/api/servicedesk/approvals/${token}`

function newToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: createHash('sha256').update(token).digest('hex') }
}

/** Pede aprovação a dois e-mails e fixa tokens conhecidos em cada pedido. */
async function requestTwo() {
  const ctx = await setupTabs()
  const res = await postJson(
    `${tabApi(ctx.workspace.id, ctx.ticket.id)}/approvals`,
    {
      approvers: [
        { email: 'gestor@example.com', name: 'Carlos Gestor' },
        { email: 'diretor@example.com' },
      ],
      message: 'Aprovar a troca do fusor',
    },
    ctx.agent.cookie,
  )
  expect(res.status).toBe(201)
  const [first, second] = (await res.json()).data as { id: string }[]
  const a = newToken()
  const b = newToken()
  await prisma.sdTicketApproval.update({
    where: { id: first.id },
    data: { tokenHash: a.hash },
  })
  await prisma.sdTicketApproval.update({
    where: { id: second.id },
    data: { tokenHash: b.hash },
  })
  return { ...ctx, first, second, tokenA: a.token, tokenB: b.token }
}

function respond(token: string, body: unknown) {
  return fetch(publicUrl(token), {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify(body),
  })
}

describe('public approval link', () => {
  it('rejects malformed and unknown tokens without a session', async () => {
    const malformed = await fetch(publicUrl('abc'), { headers: defaultHeaders })
    expect(malformed.status).toBe(404)
    const unknown = await fetch(publicUrl(newToken().token), {
      headers: defaultHeaders,
    })
    expect(unknown.status).toBe(404)
    expect((await unknown.json()).error.code).toBe('SD_APPROVAL_NOT_FOUND')
  })

  it('shows the summary and records the first answer', async () => {
    const { tokenA, tokenB, first, second, ticket, agent } = await requestTwo()

    const preview = await fetch(publicUrl(tokenA), { headers: defaultHeaders })
    expect(preview.status).toBe(200)
    const summary = (await preview.json()).data
    expect(summary.status).toBe('PENDING')
    expect(summary.approverName).toBe('Carlos Gestor')
    expect(summary.requestedByName).toBe(agent.name)
    expect(summary.ticket.code).toBe(
      `INC-${String(ticket.number).padStart(6, '0')}`,
    )
    expect(summary.ticket.title).toBe('Impressora não imprime')
    expect(summary.ticket.summary).toBe('Papel atolado no andar 3')
    expect(summary.ticket).not.toHaveProperty('description')

    const invalid = await respond(tokenA, { decision: 'MAYBE' })
    expect(invalid.status).toBe(422)

    const approved = await respond(tokenA, {
      decision: 'APPROVED',
      comment: 'Pode trocar',
    })
    expect(approved.status).toBe(200)
    const body = (await approved.json()).data
    expect(body.status).toBe('APPROVED')
    expect(body.comment).toBe('Pode trocar')
    expect(body.respondedAt).not.toBeNull()

    const twice = await respond(tokenA, { decision: 'REJECTED' })
    expect(twice.status).toBe(409)
    expect((await twice.json()).error.code).toBe('SD_APPROVAL_NOT_PENDING')

    // a primeira resposta decide: o outro pedido foi cancelado
    const sibling = await prisma.sdTicketApproval.findUniqueOrThrow({
      where: { id: second.id },
    })
    expect(sibling.status).toBe('CANCELED')
    const late = await respond(tokenB, { decision: 'REJECTED' })
    expect(late.status).toBe(409)

    const event = await prisma.sdTicketEvent.findFirst({
      where: { ticketId: ticket.id, action: 'approval.responded' },
    })
    expect(event?.toValue).toBe('APPROVED')
    const notified = await prisma.notification.findFirst({
      where: { userId: agent.id, kind: 'SD_APPROVAL_RESPONDED' },
    })
    expect(notified).not.toBeNull()
    const row = await prisma.sdTicketApproval.findUniqueOrThrow({
      where: { id: first.id },
    })
    expect(row.status).toBe('APPROVED')
  })

  it('reports expired links as 410', async () => {
    const { tokenA, first } = await requestTwo()
    await prisma.sdTicketApproval.update({
      where: { id: first.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const preview = await fetch(publicUrl(tokenA), { headers: defaultHeaders })
    expect((await preview.json()).data.status).toBe('EXPIRED')
    const res = await respond(tokenA, { decision: 'APPROVED' })
    expect(res.status).toBe(410)
    expect((await res.json()).error.code).toBe('SD_APPROVAL_EXPIRED')
  })
})
