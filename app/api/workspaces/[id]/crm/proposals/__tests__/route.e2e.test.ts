import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('POST, PATCH & DELETE /api/workspaces/[id]/crm/proposals', () => {
  it('should create, update and delete a proposal', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/proposals`,
      { name: 'Proposta X', responsibleId: user.id },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.status).toBe('DRAFT')
    expect(createdBody.data.shareToken).toBeTruthy()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${createdBody.data.id}`,
      { name: 'Proposta Y' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('CRM proposal send and public access', () => {
  it('should send a proposal and serve it publicly with view tracking', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/proposals`,
        { name: 'Proposta Pública', responsibleId: user.id },
        user.cookie,
      )
    ).json()

    const beforeSend = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(beforeSend.status).toBe(404)

    const sent = await postJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${created.data.id}/send`,
      {},
      user.cookie,
    )
    expect(sent.status).toBe(200)
    const sentBody = await sent.json()
    expect(sentBody.data.status).toBe('SENT')

    const publicRes = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(publicRes.status).toBe(200)
    const publicBody = await publicRes.json()
    expect(publicBody.data.name).toBe('Proposta Pública')
    expect(publicBody.data).not.toHaveProperty('shareToken')

    const viewRes = await fetch(
      `${BASE_URL}/api/crm/proposals/${created.data.shareToken}/view`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({ viewId: 'view-1', scrolledPct: 50 }),
      },
    )
    expect(viewRes.status).toBe(200)
  })
})

describe('CRM proposal validity', () => {
  const DAY_MS = 86_400_000

  async function sentProposal(
    cookie: string,
    workspaceId: string,
    userId: string,
  ) {
    const created = await (
      await postJson(
        `/api/workspaces/${workspaceId}/crm/proposals`,
        { name: 'Proposta Validade', responsibleId: userId },
        cookie,
      )
    ).json()
    await postJson(
      `/api/workspaces/${workspaceId}/crm/proposals/${created.data.id}/send`,
      {},
      cookie,
    )
    return created.data as {
      id: string
      shareToken: string
      validUntil: string
    }
  }

  function accept(shareToken: string, name = 'Maria Cliente') {
    return fetch(`${BASE_URL}/api/crm/proposals/${shareToken}/accept`, {
      method: 'POST',
      headers: defaultHeaders,
      body: JSON.stringify({ name }),
    })
  }

  it('should default the validity to 15 days and accept within it', async () => {
    const { user, workspace } = await authenticatedOwner()
    const proposal = await sentProposal(user.cookie, workspace.id, user.id)

    const days = (new Date(proposal.validUntil).getTime() - Date.now()) / DAY_MS
    expect(days).toBeGreaterThan(14)
    expect(days).toBeLessThanOrEqual(16)

    const res = await accept(proposal.shareToken)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('ACCEPTED')
    expect(body.data.acceptedByName).toBe('Maria Cliente')

    const again = await accept(proposal.shareToken)
    expect(again.status).toBe(409)
  })

  it('should block acceptance after expiry and let an admin extend it', async () => {
    const { user, workspace } = await authenticatedOwner()
    const proposal = await sentProposal(user.cookie, workspace.id, user.id)

    await patchJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${proposal.id}`,
      { validUntil: new Date(Date.now() - 3 * DAY_MS).toISOString() },
      user.cookie,
    )

    const publicRes = await fetch(
      `${BASE_URL}/api/crm/proposals/${proposal.shareToken}`,
      { headers: defaultHeaders },
    )
    const publicBody = await publicRes.json()
    expect(publicBody.data.isExpired).toBe(true)
    expect(publicBody.data.canAccept).toBe(false)

    const blocked = await accept(proposal.shareToken)
    expect(blocked.status).toBe(409)
    const blockedBody = await blocked.json()
    expect(blockedBody.error.code).toBe('CRM_PROPOSAL_EXPIRED')

    const member = await addMember(workspace.id, 'MEMBER')
    const newDate = new Date(Date.now() + 10 * DAY_MS).toISOString()
    const denied = await postJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${proposal.id}/extend-validity`,
      { validUntil: newDate },
      member.cookie,
    )
    expect(denied.status).toBe(403)

    const extended = await postJson(
      `/api/workspaces/${workspace.id}/crm/proposals/${proposal.id}/extend-validity`,
      { validUntil: newDate },
      user.cookie,
    )
    expect(extended.status).toBe(200)
    const extendedBody = await extended.json()
    expect(extendedBody.data.isExpired).toBe(false)

    expect((await accept(proposal.shareToken)).status).toBe(200)
  })
})
