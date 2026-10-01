import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'
import { setupTabs, tabApi } from './sd-tab-e2e.helpers'

describe('ticket approvals (agent side)', () => {
  it('is agent-only', async () => {
    const { workspace, requester, ticket } = await setupTabs()
    const res = await getJson(
      `${tabApi(workspace.id, ticket.id)}/approvals`,
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('requests, lists, cancels, resends and expires approvals', async () => {
    const { workspace, agent, requester, ticket } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)

    const outsider = await createAuthenticatedUser()
    const bad = await postJson(
      `${base}/approvals`,
      { approvers: [{ userId: outsider.id }] },
      agent.cookie,
    )
    expect(bad.status).toBe(422)

    const created = await postJson(
      `${base}/approvals`,
      {
        approvers: [
          { userId: requester.id },
          { email: 'Gestor@Example.com', name: 'Carlos' },
          { email: 'gestor@example.com' },
        ],
        message: 'Troca do fusor (R$ 320)',
        expiresInDays: 3,
      },
      agent.cookie,
    )
    expect(created.status).toBe(201)
    const rows = (await created.json()).data
    // e-mail repetido vira um pedido só
    expect(rows).toHaveLength(2)
    expect(rows.map((r: { approverEmail: string }) => r.approverEmail)).toEqual(
      [requester.email.toLowerCase(), 'gestor@example.com'],
    )
    expect(rows[0].approver.id).toBe(requester.id)
    expect(rows.every((r: { status: string }) => r.status === 'PENDING')).toBe(
      true,
    )
    // MAIL_DRY_RUN: o envio "sai" e carimba sentAt
    expect(rows.every((r: { sentAt: string | null }) => r.sentAt)).toBe(true)
    const stored = await prisma.sdTicketApproval.findFirstOrThrow({
      where: { id: rows[0].id },
    })
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/)

    const canceled = await postJson(
      `${base}/approvals/${rows[0].id}/cancel`,
      {},
      agent.cookie,
    )
    expect(canceled.status).toBe(200)
    expect((await canceled.json()).data.status).toBe('CANCELED')
    const again = await postJson(
      `${base}/approvals/${rows[0].id}/cancel`,
      {},
      agent.cookie,
    )
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('SD_APPROVAL_NOT_PENDING')
    const resendCanceled = await postJson(
      `${base}/approvals/${rows[0].id}/resend`,
      {},
      agent.cookie,
    )
    expect(resendCanceled.status).toBe(409)

    // vence → EXPIRED na leitura → reenviar gera link novo
    await prisma.sdTicketApproval.update({
      where: { id: rows[1].id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    const list = (
      await (await getJson(`${base}/approvals`, agent.cookie)).json()
    ).data
    const expired = list.find((r: { id: string }) => r.id === rows[1].id)
    expect(expired.status).toBe('EXPIRED')

    const before = await prisma.sdTicketApproval.findUniqueOrThrow({
      where: { id: rows[1].id },
    })
    const resent = await postJson(
      `${base}/approvals/${rows[1].id}/resend`,
      { expiresInDays: 10 },
      agent.cookie,
    )
    expect(resent.status).toBe(200)
    const resentBody = (await resent.json()).data
    expect(resentBody.status).toBe('PENDING')
    expect(new Date(resentBody.expiresAt).getTime()).toBeGreaterThan(
      Date.now() + 9 * 24 * 60 * 60 * 1000,
    )
    const after = await prisma.sdTicketApproval.findUniqueOrThrow({
      where: { id: rows[1].id },
    })
    expect(after.tokenHash).not.toBe(before.tokenHash)

    const missing = await postJson(
      `${base}/approvals/nope/cancel`,
      {},
      agent.cookie,
    )
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe('SD_APPROVAL_NOT_FOUND')
  })
})
