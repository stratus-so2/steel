import { describe, expect, it } from 'vitest'
import {
  seedSdIncidentCluster,
  seedSdRiskPrediction,
} from '@/src/__tests__/factories/sd-risk.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhaseFlow,
  seedSdSettings,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const sd = (workspaceId: string, path: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/risk/${path}`

/** Workspace com fluxo de incidente, um agente e um solicitante. */
async function setup() {
  const { user: agent, workspace } = await authenticatedOwner()
  await seedSdSettings(workspace.id)
  const flow = await seedSdPhaseFlow(workspace.id)
  await seedSdPhaseFlow(workspace.id, 'PROBLEM')
  const department = await seedSdDepartment(workspace.id)
  await seedSdDepartmentMember(department.id, agent.id)
  const requester = await addMember(workspace.id)
  return { agent, requester, workspace, flow, department }
}

describe('ServiceDesk predictive risk', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${sd('x', 'tickets')}`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('is agent-only: requester and stranger are refused on every route', async () => {
    const { workspace, requester } = await setup()
    const stranger = await createAuthenticatedUser()

    expect(
      (await getJson(sd(workspace.id, 'tickets'), stranger.cookie)).status,
    ).toBe(403)

    const list = await getJson(sd(workspace.id, 'tickets'), requester.cookie)
    expect(list.status).toBe(403)
    expect((await list.json()).error.code).toBe('SD_NOT_AGENT')

    expect(
      (await getJson(sd(workspace.id, 'clusters'), requester.cookie)).status,
    ).toBe(403)
    expect(
      (
        await postJson(
          sd(workspace.id, 'clusters/any/problem'),
          {},
          requester.cookie,
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await postJson(
          sd(workspace.id, 'clusters/any/dismiss'),
          {},
          requester.cookie,
        )
      ).status,
    ).toBe(403)
  })

  it('lists the risk queue with the reason inside the ticket', async () => {
    const { agent, workspace, flow } = await setup()
    const risky = await seedSdTicket(workspace.id, flow.initial.id, {
      title: 'Servidor de e-mail fora do ar',
    })
    const calm = await seedSdTicket(workspace.id, flow.initial.id, {
      title: 'Troca de mouse',
    })
    await seedSdRiskPrediction(workspace.id, risky.id, { score: 82 })
    await seedSdRiskPrediction(workspace.id, calm.id, {
      level: 'LOW',
      score: 5,
    })

    const res = await getJson(sd(workspace.id, 'tickets'), agent.cookie)
    expect(res.status).toBe(200)
    const items = (await res.json()).data
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(risky.id)
    expect(items[0].risk).toMatchObject({ level: 'HIGH', score: 82 })
    expect(items[0].risk.factors[0].detail.length).toBeGreaterThan(0)

    const low = await getJson(
      `${sd(workspace.id, 'tickets')}?level=LOW`,
      agent.cookie,
    )
    expect((await low.json()).data[0].id).toBe(calm.id)

    const filtered = await getJson(
      `${sd(workspace.id, 'tickets')}?minScore=90`,
      agent.cookie,
    )
    expect((await filtered.json()).data).toHaveLength(0)

    const invalid = await getJson(
      `${sd(workspace.id, 'tickets')}?level=URGENTE`,
      agent.cookie,
    )
    expect(invalid.status).toBe(422)
  })

  it('filters the ticket board by the risk band', async () => {
    const { agent, workspace, flow } = await setup()
    const risky = await seedSdTicket(workspace.id, flow.initial.id)
    await seedSdTicket(workspace.id, flow.initial.id)
    await seedSdRiskPrediction(workspace.id, risky.id)

    const res = await getJson(
      `/api/workspaces/${workspace.id}/servicedesk/tickets?riskLevel=HIGH`,
      agent.cookie,
    )
    expect(res.status).toBe(200)
    const page = (await res.json()).data
    expect(page.items).toHaveLength(1)
    expect(page.items[0].id).toBe(risky.id)
  })

  it('reads the prediction of one ticket by number, with the factors', async () => {
    const { agent, workspace, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id)

    const missing = await getJson(
      sd(workspace.id, `tickets/${ticket.number}`),
      agent.cookie,
    )
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe(
      'SD_RISK_PREDICTION_NOT_FOUND',
    )

    await seedSdRiskPrediction(workspace.id, ticket.id, { score: 91 })

    const res = await getJson(
      sd(workspace.id, `tickets/INC-${String(ticket.number).padStart(6, '0')}`),
      agent.cookie,
    )
    expect(res.status).toBe(200)
    const risk = (await res.json()).data
    expect(risk).toMatchObject({ level: 'HIGH', score: 91 })
    expect(risk.factors).toHaveLength(1)
    expect(risk.factors[0].key).toBe('sla_consumed')

    const unknown = await getJson(
      sd(workspace.id, 'tickets/INC-999999'),
      agent.cookie,
    )
    expect(unknown.status).toBe(404)
  })

  it('opens a problem from a cluster, links the incidents and closes the suggestion', async () => {
    const { agent, workspace, flow } = await setup()
    const incidents = []
    for (const title of ['E-mail caiu', 'E-mail caiu de novo', 'E-mail caiu']) {
      incidents.push(
        await seedSdTicket(workspace.id, flow.initial.id, { title }),
      )
    }
    const cluster = await seedSdIncidentCluster(workspace.id, {
      title: 'E-mail caiu',
      ticketIds: incidents.map((t) => t.id),
      ticketCount: incidents.length,
    })

    const list = await getJson(sd(workspace.id, 'clusters'), agent.cookie)
    expect(list.status).toBe(200)
    const groups = (await list.json()).data
    expect(groups).toHaveLength(1)
    expect(groups[0].tickets).toHaveLength(3)
    expect(groups[0].tickets[0].code).toMatch(/^INC-/)

    const opened = await postJson(
      sd(workspace.id, `clusters/${cluster.id}/problem`),
      { title: 'Causa raiz do e-mail' },
      agent.cookie,
    )
    expect(opened.status).toBe(201)
    const saved = (await opened.json()).data
    expect(saved.problemTicket).toMatchObject({
      type: 'PROBLEM',
      title: 'Causa raiz do e-mail',
    })
    expect(saved.problemTicket.code).toMatch(/^PRB-/)

    const children = await prisma.sdTicket.findMany({
      where: { parentId: saved.problemTicket.id },
      select: { id: true },
    })
    expect(children).toHaveLength(3)

    // O grupo sai das sugestões vivas e a segunda tentativa é recusada.
    const live = await getJson(sd(workspace.id, 'clusters'), agent.cookie)
    expect((await live.json()).data).toHaveLength(0)

    const again = await postJson(
      sd(workspace.id, `clusters/${cluster.id}/problem`),
      {},
      agent.cookie,
    )
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('SD_INCIDENT_CLUSTER_CLOSED')

    const handled = await getJson(
      `${sd(workspace.id, 'clusters')}?status=handled`,
      agent.cookie,
    )
    expect((await handled.json()).data).toHaveLength(1)
  })

  it('dismisses a suggestion once and refuses the unknown cluster', async () => {
    const { agent, workspace } = await setup()
    const cluster = await seedSdIncidentCluster(workspace.id)

    const res = await postJson(
      sd(workspace.id, `clusters/${cluster.id}/dismiss`),
      {},
      agent.cookie,
    )
    expect(res.status).toBe(200)
    const dismissed = (await res.json()).data
    expect(dismissed.dismissedAt).toBeTruthy()
    expect(dismissed.dismissedBy.id).toBe(agent.id)

    const again = await postJson(
      sd(workspace.id, `clusters/${cluster.id}/dismiss`),
      {},
      agent.cookie,
    )
    expect(again.status).toBe(409)

    const unknown = await postJson(
      sd(workspace.id, 'clusters/nao-existe/dismiss'),
      {},
      agent.cookie,
    )
    expect(unknown.status).toBe(404)
    expect((await unknown.json()).error.code).toBe(
      'SD_INCIDENT_CLUSTER_NOT_FOUND',
    )
  })

  it('never leaks a cluster or a prediction across workspaces', async () => {
    const { agent, workspace } = await setup()
    const other = await setup()
    const cluster = await seedSdIncidentCluster(other.workspace.id)

    const dismiss = await postJson(
      sd(workspace.id, `clusters/${cluster.id}/dismiss`),
      {},
      agent.cookie,
    )
    expect(dismiss.status).toBe(404)
  })
})
