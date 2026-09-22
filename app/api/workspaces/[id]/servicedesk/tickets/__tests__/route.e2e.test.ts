import { describe, expect, it } from 'vitest'
import {
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhaseFlow,
  seedSdPriority,
  seedSdSlaPolicy,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

const api = (ws: string) => `/api/workspaces/${ws}/servicedesk`

async function setup() {
  const { user: owner, workspace } = await authenticatedOwner()
  const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  const priority = await seedSdPriority(workspace.id, {
    name: 'P2',
    level: 2,
    isDefault: true,
  })
  await seedSdSlaPolicy(workspace.id, { name: 'SLA padrão', isDefault: true }, [
    {
      priorityId: priority.id,
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
    },
  ])
  const department = await seedSdDepartment(workspace.id)
  await seedSdDepartmentMember(department.id, owner.id, { isLead: true })
  return { owner, workspace, flow, priority, department }
}

describe('GET /api/workspaces/[id]/servicedesk/tickets', () => {
  it('returns 401 when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${api('x')}/tickets`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await getJson(`${api(workspace.id)}/tickets`, stranger.cookie)
    expect(res.status).toBe(403)
  })

  it('returns 422 for an invalid query and for a kanban without type', async () => {
    const { owner, workspace } = await setup()
    const bad = await getJson(
      `${api(workspace.id)}/tickets?sort=nope`,
      owner.cookie,
    )
    expect(bad.status).toBe(422)
    const kanban = await getJson(
      `${api(workspace.id)}/tickets?view=kanban`,
      owner.cookie,
    )
    expect(kanban.status).toBe(422)
  })
})

describe('ticket lifecycle (agent)', () => {
  it('opens, edits, moves, escalates and deletes a ticket', async () => {
    const { owner, workspace, flow, priority, department } = await setup()
    const base = api(workspace.id)

    const created = await postJson(
      `${base}/tickets`,
      {
        type: 'INCIDENT',
        title: 'Servidor de e-mail fora do ar',
        description: '<p>Urgente<script>alert(1)</script></p>',
        departmentId: department.id,
        tags: ['email'],
      },
      owner.cookie,
    )
    expect(created.status).toBe(201)
    const ticket = (await created.json()).data
    expect(ticket.code).toBe('INC-000001')
    expect(ticket.description).toBe('<p>Urgente</p>')
    expect(ticket.phase.id).toBe(flow.initial.id)
    expect(ticket.priority.id).toBe(priority.id)
    expect(ticket.firstResponseDueAt).not.toBeNull()
    expect(ticket.sla.resolution.state).toBe('ok')

    const byCode = await getJson(`${base}/tickets/INC-000001`, owner.cookie)
    expect(byCode.status).toBe(200)
    expect((await byCode.json()).data.id).toBe(ticket.id)
    const byNumber = await getJson(`${base}/tickets/1`, owner.cookie)
    expect((await byNumber.json()).data.id).toBe(ticket.id)

    const patched = await patchJson(
      `${base}/tickets/${ticket.id}`,
      { assigneeId: owner.id, title: 'E-mail fora do ar (matriz)' },
      owner.cookie,
    )
    expect(patched.status).toBe(200)
    expect((await patched.json()).data.assignee.id).toBe(owner.id)

    const noSolution = await postJson(
      `${base}/tickets/${ticket.id}/phase`,
      { phaseId: flow.resolved.id },
      owner.cookie,
    )
    expect(noSolution.status).toBe(422)
    expect((await noSolution.json()).error.code).toBe(
      'SD_PHASE_REQUIREMENTS_UNMET',
    )

    const resolved = await postJson(
      `${base}/tickets/${ticket.id}/phase`,
      { phaseId: flow.resolved.id, solution: 'Serviço reiniciado' },
      owner.cookie,
    )
    expect(resolved.status).toBe(200)
    const resolvedBody = (await resolved.json()).data
    expect(resolvedBody.resolvedAt).not.toBeNull()
    expect(resolvedBody.completionPercent).toBe(90)

    const reopened = await postJson(
      `${base}/tickets/${ticket.id}/phase`,
      { phaseId: flow.inProgress.id, comment: 'Voltou a falhar' },
      owner.cookie,
    )
    expect((await reopened.json()).data.reopenCount).toBe(1)

    const kanban = await getJson(
      `${base}/tickets?view=kanban&type=INCIDENT`,
      owner.cookie,
    )
    expect(kanban.status).toBe(200)
    const board = (await kanban.json()).data
    expect(board.columns).toHaveLength(6)
    const column = board.columns.find(
      (c: { phase: { id: string } }) => c.phase.id === flow.inProgress.id,
    )
    expect(column.count).toBe(1)

    const list = await getJson(
      `${base}/tickets?assigneeIds=me&q=matriz&tags=email`,
      owner.cookie,
    )
    const page = (await list.json()).data
    expect(page.total).toBe(1)
    expect(page.items[0].id).toBe(ticket.id)

    const summary = await getJson(`${base}/tickets/summary`, owner.cookie)
    const counts = (await summary.json()).data
    expect(counts.byPhaseCategory.IN_PROGRESS).toBe(1)
    expect(counts.myOpen).toBe(1)
    expect(counts.createdToday).toBe(1)

    const escalated = await postJson(
      `${base}/tickets/${ticket.id}/escalations`,
      { kind: 'HIERARCHICAL', reason: 'Sem solução definitiva' },
      owner.cookie,
    )
    expect(escalated.status).toBe(201)
    expect((await escalated.json()).data.escalation.toLevel).toBe(1)
    const escalations = await getJson(
      `${base}/tickets/${ticket.id}/escalations`,
      owner.cookie,
    )
    expect((await escalations.json()).data).toHaveLength(1)

    const events = await getJson(
      `${base}/tickets/${ticket.id}/events?limit=100`,
      owner.cookie,
    )
    const actions = (await events.json()).data.items.map(
      (e: { action: string }) => e.action,
    )
    expect(actions).toEqual(
      expect.arrayContaining([
        'ticket.created',
        'field.changed',
        'phase.changed',
        'ticket.reopened',
        'escalated',
      ]),
    )

    const member = await addMember(workspace.id, 'MEMBER')
    const added = await postJson(
      `${base}/tickets/${ticket.id}/participants`,
      { userId: member.id },
      owner.cookie,
    )
    expect(added.status).toBe(201)
    expect((await added.json()).data).toHaveLength(1)
    const participants = await getJson(
      `${base}/tickets/${ticket.id}/participants`,
      member.cookie,
    )
    expect(participants.status).toBe(200)
    const removed = await deleteJson(
      `${base}/tickets/${ticket.id}/participants/${member.id}`,
      owner.cookie,
    )
    expect((await removed.json()).data).toHaveLength(0)

    const child = await postJson(
      `${base}/tickets`,
      { type: 'INCIDENT', title: 'Filho' },
      owner.cookie,
    )
    const childId = (await child.json()).data.id
    const parented = await patchJson(
      `${base}/tickets/${childId}/parent`,
      { parentId: 'INC-000001' },
      owner.cookie,
    )
    expect((await parented.json()).data.parent.code).toBe('INC-000001')
    const cycle = await patchJson(
      `${base}/tickets/${ticket.id}/parent`,
      { parentId: childId },
      owner.cookie,
    )
    expect(cycle.status).toBe(422)
    const children = await getJson(
      `${base}/tickets?parentId=${ticket.id}`,
      owner.cookie,
    )
    expect((await children.json()).data.total).toBe(1)

    const bulk = await postJson(
      `${base}/tickets/bulk`,
      { ids: [ticket.id, childId, 'missing'], assigneeId: null },
      owner.cookie,
    )
    const bulkBody = (await bulk.json()).data
    expect(bulkBody.updated).toEqual([ticket.id, childId])
    expect(bulkBody.failed[0]).toMatchObject({
      id: 'missing',
      code: 'SD_TICKET_NOT_FOUND',
    })

    const deleted = await deleteJson(`${base}/tickets/${childId}`, owner.cookie)
    expect(deleted.status).toBe(200)
    const gone = await getJson(`${base}/tickets/${childId}`, owner.cookie)
    expect(gone.status).toBe(404)
  })
})

describe('requester (portal) access', () => {
  it('limits requesters to their own tickets and portal fields', async () => {
    const { owner, workspace } = await setup()
    const base = api(workspace.id)
    const requester = await addMember(workspace.id, 'MEMBER')

    const agentTicket = await postJson(
      `${base}/tickets`,
      { type: 'INCIDENT', title: 'Interno' },
      owner.cookie,
    )
    const agentTicketId = (await agentTicket.json()).data.id

    const mine = await postJson(
      `${base}/tickets`,
      { type: 'INCIDENT', title: 'Minha impressora', assigneeId: owner.id },
      requester.cookie,
    )
    expect(mine.status).toBe(201)
    const mineBody = (await mine.json()).data
    expect(mineBody.channel).toBe('PORTAL')
    expect(mineBody.requester.id).toBe(requester.id)
    expect(mineBody.assignee).toBeNull()

    const change = await postJson(
      `${base}/tickets`,
      { type: 'CHANGE', title: 'Mudança' },
      requester.cookie,
    )
    expect(change.status).toBe(403)

    const list = await getJson(`${base}/tickets`, requester.cookie)
    const page = (await list.json()).data
    expect(page.items.map((t: { id: string }) => t.id)).toEqual([mineBody.id])

    const other = await getJson(
      `${base}/tickets/${agentTicketId}`,
      requester.cookie,
    )
    expect(other.status).toBe(403)

    const internal = await patchJson(
      `${base}/tickets/${mineBody.id}`,
      { priorityId: null },
      requester.cookie,
    )
    expect(internal.status).toBe(403)

    const move = await postJson(
      `${base}/tickets/${mineBody.id}/phase`,
      { phaseId: 'whatever' },
      requester.cookie,
    )
    expect((await move.json()).error.code).toBe('SD_NOT_AGENT')

    const events = await getJson(
      `${base}/tickets/${mineBody.id}/events`,
      requester.cookie,
    )
    expect(events.status).toBe(403)
  })
})

describe('GET /api/workspaces/[id]/servicedesk/events', () => {
  it('rejects non-members before opening the stream', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await getJson(`${api(workspace.id)}/events`, stranger.cookie)
    expect(res.status).toBe(403)
  })

  it('opens the SSE stream for members', async () => {
    const { owner, workspace } = await setup()
    const controller = new AbortController()
    const res = await fetch(`${BASE_URL}${api(workspace.id)}/events`, {
      headers: { ...defaultHeaders, Cookie: owner.cookie },
      signal: controller.signal,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const reader = res.body?.getReader()
    const first = await reader?.read()
    expect(new TextDecoder().decode(first?.value)).toContain(': connected')
    controller.abort()
  })
})
