import { describe, expect, it } from 'vitest'
import { authenticatedOwner, postJson } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { createCrmUnsubscribeToken } from '@/src/lib/crm-email-unsubscribe'
import { prisma } from '@/src/lib/prisma'

async function campaignRecipient() {
  const { user, workspace } = await authenticatedOwner()
  await postJson(
    `/api/workspaces/${workspace.id}/crm/people`,
    { name: 'Fulano', emails: ['fulano@example.com'] },
    user.cookie,
  )
  const created = await (
    await postJson(
      `/api/workspaces/${workspace.id}/crm/email-campaigns`,
      {
        subject: 'Novidades',
        contentHtml: '<p>Oi</p>',
        fromAddress: 'contato@example.com',
        recipientScope: 'ALL',
      },
      user.cookie,
    )
  ).json()
  const recipient = await prisma.crmEmailCampaignRecipient.findFirstOrThrow({
    where: { campaignId: created.data.id },
  })
  return { user, workspace, recipient }
}

describe('POST /api/crm/unsubscribe/[token]', () => {
  it('should honour an RFC 8058 one-click POST without a session', async () => {
    const { user, workspace, recipient } = await campaignRecipient()
    const token = createCrmUnsubscribeToken(recipient.id)

    const res = await fetch(`${BASE_URL}/api/crm/unsubscribe/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    })
    expect(res.status).toBe(200)

    const optOut = await prisma.crmEmailOptOut.findFirstOrThrow({
      where: { workspaceId: workspace.id },
    })
    expect(optOut.email).toBe('fulano@example.com')
    expect(optOut.source).toBe('ONE_CLICK')

    // Campanhas futuras não incluem mais o endereço.
    const next = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-campaigns`,
      {
        subject: 'Outra',
        contentHtml: '<p>Oi</p>',
        fromAddress: 'contato@example.com',
        recipientScope: 'ALL',
      },
      user.cookie,
    )
    expect(next.status).toBe(422)
  })

  it('should reject a forged token', async () => {
    const [, signature] = createCrmUnsubscribeToken('whatever').split('.')
    const forged = `${Buffer.from('other').toString('base64url')}.${signature}`

    const res = await fetch(`${BASE_URL}/api/crm/unsubscribe/${forged}`, {
      method: 'POST',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/crm/unsubscribe/[token]', () => {
  it('should redirect to the confirmation page without opting out', async () => {
    const { workspace, recipient } = await campaignRecipient()
    const token = createCrmUnsubscribeToken(recipient.id)

    const res = await fetch(`${BASE_URL}/api/crm/unsubscribe/${token}`, {
      redirect: 'manual',
    })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain(`/unsubscribe/${token}`)
    expect(
      await prisma.crmEmailOptOut.count({
        where: { workspaceId: workspace.id },
      }),
    ).toBe(0)
  })

  it('should render the public confirmation page without a session', async () => {
    const { recipient } = await campaignRecipient()
    const token = createCrmUnsubscribeToken(recipient.id)

    const res = await fetch(`${BASE_URL}/unsubscribe/${token}`)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('fulano@example.com')
  })
})
