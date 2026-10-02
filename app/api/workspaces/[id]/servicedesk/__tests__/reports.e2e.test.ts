import { describe, expect, it } from 'vitest'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import { seedSdPhaseFlow } from '@/src/__tests__/factories/sd-ticket-context.factory'
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
 * Rotas dos relatórios de SLA agendados. O worker é quem gera na hora
 * marcada; aqui se verifica o contrato: acesso (agente lê, admin escreve), a
 * agenda (recusa fuso/dia inválidos), o recorte de outro workspace, o
 * pausar/retomar, o "gerar agora" (com a trava do período) e o download dos
 * arquivos.
 */

const api = (ws: string) => `/api/workspaces/${ws}/servicedesk`
const reports = (ws: string) => `${api(ws)}/reports`
const runs = (ws: string) => `${reports(ws)}/runs`

async function setup() {
  const { user: owner, workspace } = await authenticatedOwner()
  await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  return { owner, workspace }
}

const REPORT = {
  name: 'SLA mensal',
  period: 'LAST_MONTH',
  formats: ['PDF', 'CSV'],
  dayOfMonth: 1,
  atTime: '07:00',
  timezone: 'America/Sao_Paulo',
  recipients: ['gestor@example.com'],
}

async function createReport(
  workspaceId: string,
  cookie: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await postJson(
    reports(workspaceId),
    { ...REPORT, ...overrides },
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data as {
    id: string
    active: boolean
    nextRunAt: string | null
    formats: string[]
    runCount: number
    customers: { id: string; name: string }[]
  }
}

describe('/api/workspaces/[id]/servicedesk/reports', () => {
  it('refuses an anonymous request, a non-member and a requester', async () => {
    const { workspace } = await setup()

    expect((await getJson(reports(workspace.id))).status).toBe(401)

    const stranger = await createAuthenticatedUser()
    expect((await getJson(reports(workspace.id), stranger.cookie)).status).toBe(
      403,
    )

    const requester = await addMember(workspace.id, 'MEMBER')
    const asRequester = await getJson(reports(workspace.id), requester.cookie)
    expect(asRequester.status).toBe(403)
    expect((await asRequester.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('creates a schedule with the next send already computed', async () => {
    const { owner, workspace } = await setup()
    const customer = await seedSdCustomer(workspace.id, owner.id, {
      name: 'ACME',
    })

    const report = await createReport(workspace.id, owner.cookie, {
      customerIds: [customer.id],
      ticketTypes: ['INCIDENT'],
      includeAccountOwners: true,
    })

    expect(report).toMatchObject({ active: true, runCount: 0 })
    expect(report.customers).toEqual([{ id: customer.id, name: 'ACME' }])
    // Dia 1 às 07:00 em São Paulo = 10:00 UTC.
    expect(report.nextRunAt?.endsWith('T10:00:00.000Z')).toBe(true)

    const list = await getJson(reports(workspace.id), owner.cookie)
    expect(list.status).toBe(200)
    expect(
      ((await list.json()).data as { id: string }[]).map((r) => r.id),
    ).toEqual([report.id])
  })

  it.each([
    ['an unknown timezone', { timezone: 'Mars/Olympus' }],
    ['a malformed time', { atTime: '7h' }],
    ['a day out of range', { dayOfMonth: 31 }],
    ['no format', { formats: [] }],
    ['a bad recipient', { recipients: ['não-é-email'] }],
  ])('refuses %s', async (_label, patch) => {
    const { owner, workspace } = await setup()

    const res = await postJson(
      reports(workspace.id),
      { ...REPORT, ...patch },
      owner.cookie,
    )

    expect(res.status).toBe(422)
    const code = (await res.json()).error.code
    expect(['VALIDATION_ERROR', 'SD_REPORT_SCHEDULE_INVALID']).toContain(code)
  })

  it('refuses a scope of another workspace', async () => {
    const { owner, workspace } = await setup()
    const { user: otherOwner, workspace: other } = await authenticatedOwner()
    const foreign = await seedSdCustomer(other.id, otherOwner.id)

    const res = await postJson(
      reports(workspace.id),
      { ...REPORT, customerIds: [foreign.id] },
      owner.cookie,
    )

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('SD_CONFIG_NOT_FOUND')
  })

  it('pauses, resumes and edits the schedule', async () => {
    const { owner, workspace } = await setup()
    const report = await createReport(workspace.id, owner.cookie)

    const paused = await patchJson(
      `${reports(workspace.id)}/${report.id}`,
      { active: false },
      owner.cookie,
    )
    expect(paused.status).toBe(200)
    expect((await paused.json()).data).toMatchObject({
      active: false,
      nextRunAt: null,
    })

    const resumed = await patchJson(
      `${reports(workspace.id)}/${report.id}`,
      { active: true, dayOfMonth: 15, atTime: '08:30', formats: ['CSV'] },
      owner.cookie,
    )
    expect(resumed.status).toBe(200)
    const data = (await resumed.json()).data as {
      nextRunAt: string
      formats: string[]
    }
    expect(data.formats).toEqual(['CSV'])
    expect(data.nextRunAt.endsWith('T11:30:00.000Z')).toBe(true)

    const broken = await patchJson(
      `${reports(workspace.id)}/${report.id}`,
      { timezone: 'Mars/Olympus' },
      owner.cookie,
    )
    expect(broken.status).toBe(422)
    expect((await broken.json()).error.code).toBe('SD_REPORT_SCHEDULE_INVALID')
  })

  it('soft-deletes the schedule and 404s afterwards', async () => {
    const { owner, workspace } = await setup()
    const report = await createReport(workspace.id, owner.cookie)

    expect(
      (await deleteJson(`${reports(workspace.id)}/${report.id}`, owner.cookie))
        .status,
    ).toBe(200)

    const gone = await getJson(
      `${reports(workspace.id)}/${report.id}`,
      owner.cookie,
    )
    expect(gone.status).toBe(404)
    expect((await gone.json()).error.code).toBe('SD_REPORT_NOT_FOUND')
    expect(
      (await (await getJson(reports(workspace.id), owner.cookie)).json()).data,
    ).toEqual([])
  })

  it('lets an agent read but not write', async () => {
    const { owner, workspace } = await setup()
    const report = await createReport(workspace.id, owner.cookie)

    const agent = await addMember(workspace.id, 'MEMBER')
    const department = await postJson(
      `${api(workspace.id)}/departments`,
      { name: 'Infra' },
      owner.cookie,
    )
    expect(department.status).toBe(201)
    const departmentId = (await department.json()).data.id as string
    expect(
      (
        await postJson(
          `${api(workspace.id)}/departments/${departmentId}/members`,
          { userId: agent.id },
          owner.cookie,
        )
      ).status,
    ).toBe(201)

    const list = await getJson(reports(workspace.id), agent.cookie)
    expect(list.status).toBe(200)
    expect((await list.json()).data).toHaveLength(1)

    expect((await getJson(runs(workspace.id), agent.cookie)).status).toBe(200)

    const write = await patchJson(
      `${reports(workspace.id)}/${report.id}`,
      { active: false },
      agent.cookie,
    )
    expect(write.status).toBe(403)
    expect((await write.json()).error.code).toBe('FORBIDDEN')

    const generate = await postJson(runs(workspace.id), {}, agent.cookie)
    expect(generate.status).toBe(403)
  })

  it('generates a report on demand, serves the files and keeps the history', async () => {
    const { owner, workspace } = await setup()

    const generated = await postJson(
      runs(workspace.id),
      { period: 'LAST_30_DAYS', formats: ['PDF', 'CSV'] },
      owner.cookie,
    )
    expect(generated.status).toBe(201)
    const run = (await generated.json()).data as {
      id: string
      status: string
      reportId: string | null
      formats: string[]
      recipients: string[]
      summary: { volume: { opened: number } } | null
    }
    // Sem destinatário: gera os arquivos e fica no histórico.
    expect(run.status).toBe('GENERATED')
    expect(run.reportId).toBeNull()
    expect(run.formats).toEqual(['PDF', 'CSV'])
    expect(run.recipients).toEqual([])
    expect(run.summary?.volume.opened).toBe(0)

    const history = await getJson(runs(workspace.id), owner.cookie)
    expect(history.status).toBe(200)
    expect(((await history.json()).data as { id: string }[])[0].id).toBe(run.id)

    const pdf = await getJson(
      `${runs(workspace.id)}/${run.id}/download?format=PDF`,
      owner.cookie,
    )
    expect(pdf.status).toBe(200)
    expect(pdf.headers.get('content-type')).toContain('application/pdf')
    expect(pdf.headers.get('content-disposition')).toContain('attachment')
    const bytes = Buffer.from(await pdf.arrayBuffer())
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-')

    const csv = await getJson(
      `${runs(workspace.id)}/${run.id}/download?format=CSV`,
      owner.cookie,
    )
    expect(csv.status).toBe(200)
    expect(await csv.text()).toContain('Relatório de SLA')

    const bad = await getJson(
      `${runs(workspace.id)}/${run.id}/download?format=XLSX`,
      owner.cookie,
    )
    expect(bad.status).toBe(422)

    const missing = await getJson(
      `${runs(workspace.id)}/nope/download`,
      owner.cookie,
    )
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe('SD_REPORT_RUN_NOT_FOUND')
  })

  it('does not generate the same period of a schedule twice', async () => {
    const { owner, workspace } = await setup()
    const report = await createReport(workspace.id, owner.cookie, {
      formats: ['CSV'],
    })

    const first = await postJson(
      runs(workspace.id),
      { reportId: report.id },
      owner.cookie,
    )
    expect(first.status).toBe(201)
    const firstRun = (await first.json()).data as { id: string }

    const second = await postJson(
      runs(workspace.id),
      { reportId: report.id },
      owner.cookie,
    )
    expect(second.status).toBe(201)
    expect(((await second.json()).data as { id: string }).id).toBe(firstRun.id)

    const history = await getJson(
      `${runs(workspace.id)}?reportId=${report.id}`,
      owner.cookie,
    )
    expect((await history.json()).data).toHaveLength(1)

    const unknown = await getJson(
      `${runs(workspace.id)}?reportId=nope`,
      owner.cookie,
    )
    expect(unknown.status).toBe(404)
    expect((await unknown.json()).error.code).toBe('SD_REPORT_NOT_FOUND')
  })
})
