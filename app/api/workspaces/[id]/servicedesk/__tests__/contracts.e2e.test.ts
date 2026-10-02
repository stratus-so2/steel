import { describe, expect, it } from 'vitest'
import {
  seedSdCustomer,
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhaseFlow,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'

/**
 * Contratos de atendimento e apontamento de horas. Cobre o contrato HTTP:
 * quem pode (admin × agente × solicitante × não-membro), a sobreposição de
 * vigência, o carimbo do contrato na abertura do chamado, o cronômetro (um
 * por usuário) e o fechamento do período congelando os apontamentos.
 */

const api = (ws: string) => `/api/workspaces/${ws}/servicedesk`
const contracts = (ws: string) => `${api(ws)}/contracts`
const tickets = (ws: string) => `${api(ws)}/tickets`
const hours = (ws: string, ticket: string) =>
  `${tickets(ws)}/${ticket}/time-entries`

interface ContractBody {
  id: string
  status: string
  rates: { id: string; window: string; hourlyRate: string }[]
  currentPeriod: { id: string; includedMinutes: number } | null
  hourlyRate: string
}

async function setup() {
  const { user: owner, workspace } = await authenticatedOwner()
  await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  const customer = await seedSdCustomer(workspace.id, owner.id, {
    name: 'Stratus Telecom',
  })
  return { owner, workspace, customer }
}

/** Membro de um departamento = agente (não-admin). */
async function addAgent(workspaceId: string) {
  const agent = await addMember(workspaceId, 'MEMBER')
  const department = await seedSdDepartment(workspaceId)
  await seedSdDepartmentMember(department.id, agent.id)
  return agent
}

function contractPayload(customerId: string, overrides = {}) {
  return {
    customerId,
    name: 'Suporte mensal 20 h',
    code: 'CT-001',
    status: 'ACTIVE',
    startsAt: '2026-01-01T00:00:00.000Z',
    billingCycle: 'MONTHLY',
    includedMinutes: 1200,
    hourlyRate: '150,00',
    overtimeRate: 200,
    roundingMinutes: 15,
    minimumMinutes: 30,
    rates: [{ window: 'AFTER_HOURS', hourlyRate: '300', multiplier: 1.5 }],
    ...overrides,
  }
}

async function createContract(
  workspaceId: string,
  cookie: string,
  customerId: string,
  overrides = {},
): Promise<ContractBody> {
  const res = await postJson(
    contracts(workspaceId),
    contractPayload(customerId, overrides),
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data as ContractBody
}

async function openTicket(
  workspaceId: string,
  cookie: string,
  customerId: string,
) {
  const res = await postJson(
    tickets(workspaceId),
    { type: 'INCIDENT', title: 'Link do cliente caiu', customerId },
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string; number: number }
}

describe('/api/workspaces/[id]/servicedesk/contracts', () => {
  it('refuses a stranger, a requester and an unauthenticated call', async () => {
    const { workspace, customer } = await setup()

    const stranger = await createAuthenticatedUser()
    expect(
      (await getJson(contracts(workspace.id), stranger.cookie)).status,
    ).toBe(403)

    const requester = await addMember(workspace.id, 'MEMBER')
    const asRequester = await getJson(contracts(workspace.id), requester.cookie)
    expect(asRequester.status).toBe(403)
    expect((await asRequester.json()).error.code).toBe('SD_NOT_AGENT')

    expect((await getJson(contracts(workspace.id))).status).toBe(401)
    expect(
      (
        await postJson(
          contracts(workspace.id),
          contractPayload(customer.id),
          requester.cookie,
        )
      ).status,
    ).toBe(403)
  })

  it('lets an agent read but only an admin write', async () => {
    const { owner, workspace, customer } = await setup()
    const contract = await createContract(
      workspace.id,
      owner.cookie,
      customer.id,
    )
    const agent = await addAgent(workspace.id)

    const list = await getJson(contracts(workspace.id), agent.cookie)
    expect(list.status).toBe(200)
    expect((await list.json()).data).toHaveLength(1)

    const forbidden = await patchJson(
      `${contracts(workspace.id)}/${contract.id}`,
      { name: 'Outro nome' },
      agent.cookie,
    )
    expect(forbidden.status).toBe(403)
  })

  it('creates with the rate table, opens the current period and refuses overlap', async () => {
    const { owner, workspace, customer } = await setup()
    const contract = await createContract(
      workspace.id,
      owner.cookie,
      customer.id,
    )

    expect(contract.hourlyRate).toBe('150.00')
    expect(contract.rates).toHaveLength(1)
    expect(contract.rates[0].hourlyRate).toBe('300.00')
    expect(contract.currentPeriod?.includedMinutes).toBe(1200)

    const clash = await postJson(
      contracts(workspace.id),
      contractPayload(customer.id, { name: 'Outro', code: 'CT-002' }),
      owner.cookie,
    )
    expect(clash.status).toBe(409)
    expect((await clash.json()).error.code).toBe('SD_CONTRACT_OVERLAP')

    // Em rascunho, não concorre com o vigente.
    const draft = await postJson(
      contracts(workspace.id),
      contractPayload(customer.id, {
        name: 'Rascunho',
        code: 'CT-003',
        status: 'DRAFT',
      }),
      owner.cookie,
    )
    expect(draft.status).toBe(201)
  })

  it('refuses a customer from another workspace', async () => {
    const { owner, workspace } = await setup()
    const other = await authenticatedOwner()
    const outsider = await seedSdCustomer(other.workspace.id, other.user.id)

    const res = await postJson(
      contracts(workspace.id),
      contractPayload(outsider.id),
      owner.cookie,
    )
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('replaces the rate table on update and soft deletes', async () => {
    const { owner, workspace, customer } = await setup()
    const contract = await createContract(
      workspace.id,
      owner.cookie,
      customer.id,
    )

    const updated = await patchJson(
      `${contracts(workspace.id)}/${contract.id}`,
      { rates: [{ window: 'HOLIDAY', hourlyRate: '500' }] },
      owner.cookie,
    )
    expect(updated.status).toBe(200)
    const body = (await updated.json()).data as ContractBody
    expect(body.rates).toHaveLength(1)
    expect(body.rates[0].window).toBe('HOLIDAY')

    expect(
      (
        await deleteJson(
          `${contracts(workspace.id)}/${contract.id}`,
          owner.cookie,
        )
      ).status,
    ).toBe(200)
    const gone = await getJson(
      `${contracts(workspace.id)}/${contract.id}`,
      owner.cookie,
    )
    expect(gone.status).toBe(404)
    expect((await gone.json()).error.code).toBe('SD_CONTRACT_NOT_FOUND')
  })

  it('summarises the current contract of a customer', async () => {
    const { owner, workspace, customer } = await setup()
    const empty = await getJson(
      `${contracts(workspace.id)}/summary?customerId=${customer.id}`,
      owner.cookie,
    )
    expect(empty.status).toBe(200)
    expect((await empty.json()).data.contract).toBeNull()

    await createContract(workspace.id, owner.cookie, customer.id)
    const res = await getJson(
      `${contracts(workspace.id)}/summary?customerId=${customer.id}`,
      owner.cookie,
    )
    expect(res.status).toBe(200)
    const data = (await res.json()).data
    expect(data.contract.code).toBe('CT-001')
    expect(data.period.includedMinutes).toBe(1200)

    expect(
      (await getJson(`${contracts(workspace.id)}/summary`, owner.cookie))
        .status,
    ).toBe(422)
  })
})

describe('/api/workspaces/[id]/servicedesk/tickets/[ticketId]/time-entries', () => {
  it('stamps the contract on the ticket and prices the timer by its rules', async () => {
    const { owner, workspace, customer } = await setup()
    await createContract(workspace.id, owner.cookie, customer.id)
    const ticket = await openTicket(workspace.id, owner.cookie, customer.id)

    const started = await postJson(
      `${hours(workspace.id, ticket.id)}/timer`,
      { action: 'start', description: 'Diagnóstico' },
      owner.cookie,
    )
    expect(started.status).toBe(200)
    const running = (await started.json()).data
    expect(running.endedAt).toBeNull()
    expect(running.contractId).not.toBeNull()

    // Um cronômetro por usuário.
    const second = await postJson(
      `${hours(workspace.id, ticket.id)}/timer`,
      { action: 'start' },
      owner.cookie,
    )
    expect(second.status).toBe(409)
    expect((await second.json()).error.code).toBe('SD_TIME_ENTRY_RUNNING')

    const stopped = await postJson(
      `${hours(workspace.id, ticket.id)}/timer`,
      { action: 'stop' },
      owner.cookie,
    )
    expect(stopped.status).toBe(200)
    const entry = (await stopped.json()).data
    // Poucos segundos → 15 (arredondamento) → 30 (mínimo do primeiro do dia).
    expect(entry.minutes).toBe(30)
    expect(entry.amount).toBe('75.00')
    expect(entry.endedAt).not.toBeNull()

    // Parar sem cronômetro aberto é recusado.
    const again = await postJson(
      `${hours(workspace.id, ticket.id)}/timer`,
      { action: 'stop' },
      owner.cookie,
    )
    expect(again.status).toBe(422)
    expect((await again.json()).error.code).toBe('SD_TIME_ENTRY_INVALID')
  })

  it('logs hours manually, totals them and lets the author edit and delete', async () => {
    const { owner, workspace, customer } = await setup()
    await createContract(workspace.id, owner.cookie, customer.id)
    const ticket = await openTicket(workspace.id, owner.cookie, customer.id)

    const created = await postJson(
      hours(workspace.id, ticket.id),
      {
        startedAt: '2026-10-07T13:00:00.000Z',
        endedAt: '2026-10-07T14:00:00.000Z',
        billable: true,
        description: 'Troca do switch',
      },
      owner.cookie,
    )
    expect(created.status).toBe(201)
    const entry = (await created.json()).data
    expect(entry.minutes).toBe(60)
    expect(entry.editable).toBe(true)

    const list = await getJson(hours(workspace.id, ticket.id), owner.cookie)
    expect(list.status).toBe(200)
    const body = (await list.json()).data
    expect(body.items).toHaveLength(1)
    expect(body.summary.totalMinutes).toBe(60)
    expect(body.contract.name).toBe('Suporte mensal 20 h')

    const patched = await patchJson(
      `${hours(workspace.id, ticket.id)}/${entry.id}`,
      { endedAt: '2026-10-07T14:30:00.000Z', billable: false },
      owner.cookie,
    )
    expect(patched.status).toBe(200)
    expect((await patched.json()).data.minutes).toBe(90)

    expect(
      (
        await deleteJson(
          `${hours(workspace.id, ticket.id)}/${entry.id}`,
          owner.cookie,
        )
      ).status,
    ).toBe(200)
    const after = await getJson(hours(workspace.id, ticket.id), owner.cookie)
    expect((await after.json()).data.items).toHaveLength(0)
  })

  it('records time without a contract, with no amount', async () => {
    const { owner, workspace, customer } = await setup()
    const ticket = await openTicket(workspace.id, owner.cookie, customer.id)

    const created = await postJson(
      hours(workspace.id, ticket.id),
      {
        startedAt: '2026-10-07T13:00:00.000Z',
        endedAt: '2026-10-07T13:07:00.000Z',
      },
      owner.cookie,
    )
    expect(created.status).toBe(201)
    const entry = (await created.json()).data
    expect(entry.minutes).toBe(7)
    expect(entry.amount).toBeNull()
    expect(entry.contractId).toBeNull()
  })

  it('refuses a requester and keeps one agent out of another agent entry', async () => {
    const { owner, workspace, customer } = await setup()
    await createContract(workspace.id, owner.cookie, customer.id)
    const ticket = await openTicket(workspace.id, owner.cookie, customer.id)

    const requester = await addMember(workspace.id, 'MEMBER')
    const denied = await getJson(
      hours(workspace.id, ticket.id),
      requester.cookie,
    )
    expect(denied.status).toBe(403)

    const created = await postJson(
      hours(workspace.id, ticket.id),
      {
        startedAt: '2026-10-07T13:00:00.000Z',
        endedAt: '2026-10-07T14:00:00.000Z',
      },
      owner.cookie,
    )
    const entry = (await created.json()).data

    const agent = await addAgent(workspace.id)
    const asAgent = await getJson(hours(workspace.id, ticket.id), agent.cookie)
    expect(asAgent.status).toBe(200)
    expect((await asAgent.json()).data.items[0].editable).toBe(false)

    const forbidden = await patchJson(
      `${hours(workspace.id, ticket.id)}/${entry.id}`,
      { billable: false },
      agent.cookie,
    )
    expect(forbidden.status).toBe(403)

    // Agente comum também não aponta por outro.
    const byOther = await postJson(
      hours(workspace.id, ticket.id),
      {
        startedAt: '2026-10-07T15:00:00.000Z',
        endedAt: '2026-10-07T16:00:00.000Z',
        userId: owner.id,
      },
      agent.cookie,
    )
    expect(byOther.status).toBe(403)
  })

  it('freezes the entries once the period is closed', async () => {
    const { owner, workspace, customer } = await setup()
    const contract = await createContract(
      workspace.id,
      owner.cookie,
      customer.id,
      { includedMinutes: 0 },
    )
    const ticket = await openTicket(workspace.id, owner.cookie, customer.id)

    const created = await postJson(
      hours(workspace.id, ticket.id),
      {
        startedAt: new Date().toISOString(),
        endedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
      owner.cookie,
    )
    expect(created.status).toBe(201)
    const entry = (await created.json()).data

    const closed = await postJson(
      `${contracts(workspace.id)}/${contract.id}/periods/close`,
      {},
      owner.cookie,
    )
    expect(closed.status).toBe(200)
    const period = (await closed.json()).data
    expect(period.status).toBe('CLOSED')
    expect(period.billableMinutes).toBe(60)
    expect(period.overageMinutes).toBe(60)
    // Sem franquia, 1 h a R$ 200 (hora de excedente).
    expect(period.amount).toBe('200.00')

    const frozen = await patchJson(
      `${hours(workspace.id, ticket.id)}/${entry.id}`,
      { billable: false },
      owner.cookie,
    )
    expect(frozen.status).toBe(409)
    expect((await frozen.json()).error.code).toBe('SD_CONTRACT_PERIOD_CLOSED')

    // Fechar de novo é recusado.
    const twice = await postJson(
      `${contracts(workspace.id)}/${contract.id}/periods/close`,
      {},
      owner.cookie,
    )
    expect(twice.status).toBe(409)

    const periods = await getJson(
      `${contracts(workspace.id)}/${contract.id}/periods`,
      owner.cookie,
    )
    expect(periods.status).toBe(200)
    expect((await periods.json()).data[0].status).toBe('CLOSED')
  })
})
