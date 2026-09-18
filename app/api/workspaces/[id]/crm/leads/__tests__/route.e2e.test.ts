import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('GET /api/workspaces/[id]/crm/leads', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces/some-id/crm/leads`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/leads', () => {
  it('should create a lead scored by active scoring rules', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/lead-scoring-rules`,
      { field: 'email', operator: 'is_not_empty', points: 15 },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.score).toBe(15)
  })

  it('should route a lead to the owner of the first matching rule', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/lead-routing-rules`,
      { field: 'source', operator: 'equals', value: 'ads', ownerId: user.id },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.ownerId).toBe(user.id)
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/leads/[leadId]', () => {
  it('should update a lead', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}`,
      { jobTitle: 'CTO' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.jobTitle).toBe('CTO')
    expect(updatedBody.data.stage).toBe('RECEIVED')
  })

  it('should soft delete a lead', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('POST /api/workspaces/[id]/crm/leads/[leadId]/convert (legacy)', () => {
  it('should return 409 for a lead that was not closed as won', async () => {
    const { user, workspace } = await authenticatedOwner()
    const lead = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${lead.data.id}/convert`,
      {},
      user.cookie,
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CRM_LEAD_STAGE_TRANSITION_INVALID')
  })
})

describe('CRM lead intake dedupe', () => {
  it('should return 409 CRM_LEAD_DUPLICATE for an open lead with the same e-mail', async () => {
    const { user, workspace } = await authenticatedOwner()
    await postJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
      user.cookie,
    )

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      { name: 'Jane D.', emails: ['JANE@acme.com'], source: 'site' },
      user.cookie,
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CRM_LEAD_DUPLICATE')
  })
})

describe('CRM lead 6-stage pipeline', () => {
  it('should walk RECEIVED -> CLOSED (WON) through every gate', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()
    const leadId = created.data.id
    expect(created.data.stage).toBe('RECEIVED')

    // 01 -> 02: primeira tentativa de contato
    const attempt = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/contact-attempts`,
      { contactedWith: 'Jane', channel: 'WHATSAPP', outcome: 'ATTEMPTED' },
      user.cookie,
    )
    expect(attempt.status).toBe(201)
    expect((await attempt.json()).data.lead.stage).toBe('IN_CONTACT')

    // 02 -> 03: contato efetivo
    const reached = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/contact-attempts`,
      { contactedWith: 'Jane', channel: 'WHATSAPP', outcome: 'REACHED' },
      user.cookie,
    )
    expect((await reached.json()).data.lead.stage).toBe('QUALIFIED')

    // 03 -> 04: qualificação completa
    const qualified = await putJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/qualification`,
      { decisionMakerName: 'Carlos', decisionMakerRole: 'CTO' },
      user.cookie,
    )
    expect((await qualified.json()).data.lead.stage).toBe('OPPORTUNITY')

    // 04: reunião obrigatória antes da proposta
    const meeting = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/meetings`,
      {
        scheduledAt: new Date().toISOString(),
        format: 'ONLINE',
        interestDetails: 'Quer automatizar o funil',
        identifiedNeed: 'Falta de visibilidade',
      },
      user.cookie,
    )
    expect(meeting.status).toBe(201)

    // 04 -> 05: criar a proposta é a transição
    const proposal = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/proposal`,
      { name: 'Proposta Jane' },
      user.cookie,
    )
    expect(proposal.status).toBe(201)
    const proposalBody = await proposal.json()
    expect(proposalBody.data.lead.stage).toBe('PROPOSAL')
    const proposalId = proposalBody.data.proposal.id

    // 05: apresentação (termômetro de interesse)
    const presentation = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/proposal/${proposalId}/presentations`,
      {
        presentedAt: new Date().toISOString(),
        format: 'ONLINE',
        amount: 1500,
        interestLevel: 'HIGH',
        interactionsCount: 3,
      },
      user.cookie,
    )
    expect(presentation.status).toBe(201)

    // 05 -> 06: ganho, converte o lead em pessoa
    const closed = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/close-won`,
      {
        contractSignedAt: new Date().toISOString(),
        billingType: 'MONTHLY',
        closedAmount: 1500,
        contractSignedConfirmed: true,
      },
      user.cookie,
    )
    expect(closed.status).toBe(201)
    const closedBody = await closed.json()
    expect(closedBody.data.name).toBe('Jane Doe')

    const leadAfter = await (
      await getJson(
        `/api/workspaces/${workspace.id}/crm/leads/${leadId}`,
        user.cookie,
      )
    ).json()
    expect(leadAfter.data.stage).toBe('CLOSED')
    expect(leadAfter.data.closeResult).toBe('WON')
    expect(leadAfter.data.convertedPersonId).toBe(closedBody.data.id)

    // Rota legada de conversão: idempotente, devolve a mesma pessoa.
    const converted = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/convert`,
      {},
      user.cookie,
    )
    expect(converted.status).toBe(200)
    expect((await converted.json()).data.id).toBe(closedBody.data.id)

    const people = await (
      await getJson(`/api/workspaces/${workspace.id}/crm/people`, user.cookie)
    ).json()
    expect(people.data).toHaveLength(1)
  })

  it('should not allow skipping a stage', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}/meetings`,
      {
        scheduledAt: new Date().toISOString(),
        format: 'ONLINE',
        interestDetails: 'x',
        identifiedNeed: 'y',
      },
      user.cookie,
    )
    expect(res.status).toBe(409)
  })

  it('should not allow closing won without a proposal presentation', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}/close-won`,
      {
        contractSignedAt: new Date().toISOString(),
        billingType: 'MONTHLY',
        closedAmount: 1500,
        contractSignedConfirmed: true,
      },
      user.cookie,
    )
    expect(res.status).toBe(409)
  })

  it('should close an early-stage lead as lost without a presentation', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}/close-lost`,
      { lostReason: 'Sem resposta' },
      user.cookie,
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.stage).toBe('CLOSED')
    expect(body.data.closeResult).toBe('LOST')
  })
})

describe('POST /api/workspaces/[id]/crm/leads/[leadId]/reopen', () => {
  async function lostLead(cookie: string, workspaceId: string) {
    const created = await (
      await postJson(
        `/api/workspaces/${workspaceId}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        cookie,
      )
    ).json()
    await postJson(
      `/api/workspaces/${workspaceId}/crm/leads/${created.data.id}/close-lost`,
      { lostReason: 'Sem resposta' },
      cookie,
    )
    return created.data.id as string
  }

  it('should reopen a lost lead into the configured stage and keep the history', async () => {
    const { user, workspace } = await authenticatedOwner()
    const leadId = await lostLead(user.cookie, workspace.id)

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/reopen`,
      { reason: 'Cliente voltou a responder' },
      user.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.stage).toBe('RECEIVED')
    expect(body.data.closeResult).toBeNull()
    expect(body.data.lostReason).toBeNull()

    const history = await getJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/reopenings`,
      user.cookie,
    )
    expect(history.status).toBe(200)
    const historyBody = await history.json()
    expect(historyBody.data).toHaveLength(1)
    expect(historyBody.data[0]).toMatchObject({
      reason: 'Cliente voltou a responder',
      previousLostReason: 'Sem resposta',
      toStage: 'RECEIVED',
    })
  })

  it('should require a reason', async () => {
    const { user, workspace } = await authenticatedOwner()
    const leadId = await lostLead(user.cookie, workspace.id)

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${leadId}/reopen`,
      { reason: '' },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should refuse to reopen a lead that is not lost', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/leads`,
        { name: 'Jane Doe', emails: ['jane@acme.com'], source: 'ads' },
        user.cookie,
      )
    ).json()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/leads/${created.data.id}/reopen`,
      { reason: 'Retomou' },
      user.cookie,
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CRM_LEAD_REOPEN_NOT_ALLOWED')
  })
})
