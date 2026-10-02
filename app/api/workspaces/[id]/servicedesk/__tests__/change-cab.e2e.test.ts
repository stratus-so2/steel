import { createHash, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { seedSdConfigItem } from '@/src/__tests__/factories/sd-config-item.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhaseFlow,
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
import { prisma } from '@/src/lib/prisma'

const sd = (workspaceId: string, path: string) =>
  `/api/workspaces/${workspaceId}/servicedesk/${path}`

const WINDOW = {
  name: 'Janela de manutenção · sábados',
  startsAt: '2026-10-03T02:00:00.000Z',
  endsAt: '2026-10-03T06:00:00.000Z',
}

/** Workspace com fluxo de mudança, um agente e um solicitante. */
async function setup() {
  const { user: agent, workspace } = await authenticatedOwner()
  const flow = await seedSdPhaseFlow(workspace.id, 'CHANGE')
  const department = await seedSdDepartment(workspace.id)
  await seedSdDepartmentMember(department.id, agent.id)
  const requester = await addMember(workspace.id)
  return { agent, requester, workspace, flow, department }
}

describe('ServiceDesk change windows', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${sd('x', 'change-windows')}`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('is agent-only to read and admin-only to write', async () => {
    const { workspace, requester } = await setup()
    const stranger = await createAuthenticatedUser()

    expect(
      (await getJson(sd(workspace.id, 'change-windows'), stranger.cookie))
        .status,
    ).toBe(403)

    const asRequester = await getJson(
      sd(workspace.id, 'change-windows'),
      requester.cookie,
    )
    expect(asRequester.status).toBe(403)
    expect((await asRequester.json()).error.code).toBe('SD_NOT_AGENT')

    const write = await postJson(
      sd(workspace.id, 'change-windows'),
      WINDOW,
      requester.cookie,
    )
    expect(write.status).toBe(403)
  })

  it('creates, lists, filters, updates and deletes a window', async () => {
    const { agent, workspace, department } = await setup()

    const created = await postJson(
      sd(workspace.id, 'change-windows'),
      {
        ...WINDOW,
        recurrence: { freq: 'WEEKLY', byDay: ['sat'] },
        departmentIds: [department.id],
        description: 'Troca de equipamentos',
      },
      agent.cookie,
    )
    expect(created.status).toBe(201)
    const window = (await created.json()).data
    expect(window).toMatchObject({
      kind: 'MAINTENANCE',
      timezone: 'America/Sao_Paulo',
      departmentIds: [department.id],
    })
    expect(window.recurrence).toMatchObject({ freq: 'WEEKLY', byDay: ['sat'] })
    expect(window.createdBy.id).toBe(agent.id)

    const freeze = await postJson(
      sd(workspace.id, 'change-windows'),
      {
        name: 'Congelamento de fim de ano',
        kind: 'FREEZE',
        startsAt: '2026-12-20T00:00:00.000Z',
        endsAt: '2027-01-05T00:00:00.000Z',
      },
      agent.cookie,
    )
    expect(freeze.status).toBe(201)

    const all = await getJson(sd(workspace.id, 'change-windows'), agent.cookie)
    expect((await all.json()).data).toHaveLength(2)
    const onlyFreeze = await getJson(
      sd(workspace.id, 'change-windows?kind=FREEZE'),
      agent.cookie,
    )
    expect((await onlyFreeze.json()).data).toHaveLength(1)

    const updated = await patchJson(
      sd(workspace.id, `change-windows/${window.id}`),
      { name: 'Janela nova', recurrence: null },
      agent.cookie,
    )
    expect(updated.status).toBe(200)
    const after = (await updated.json()).data
    expect(after.name).toBe('Janela nova')
    expect(after.recurrence).toBeNull()

    const removed = await deleteJson(
      sd(workspace.id, `change-windows/${window.id}`),
      agent.cookie,
    )
    expect(removed.status).toBe(200)
    const gone = await patchJson(
      sd(workspace.id, `change-windows/${window.id}`),
      { name: 'X' },
      agent.cookie,
    )
    expect(gone.status).toBe(404)
    expect((await gone.json()).error.code).toBe('SD_CHANGE_WINDOW_NOT_FOUND')
  })

  it('refuses an impossible period with SD_CHANGE_WINDOW_INVALID', async () => {
    const { agent, workspace } = await setup()
    const res = await postJson(
      sd(workspace.id, 'change-windows'),
      { ...WINDOW, endsAt: '2026-10-03T01:00:00.000Z' },
      agent.cookie,
    )
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('SD_CHANGE_WINDOW_INVALID')
  })

  it('refuses a bad payload with VALIDATION_ERROR', async () => {
    const { agent, workspace } = await setup()
    const res = await postJson(
      sd(workspace.id, 'change-windows'),
      { ...WINDOW, timezone: 'Marte/Base' },
      agent.cookie,
    )
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
  })
})

describe('ServiceDesk change calendar', () => {
  it('expands the recurrence and flags freezes and conflicts', async () => {
    const { agent, workspace, flow } = await setup()
    const item = await seedSdConfigItem(workspace.id, agent.id, {
      name: 'Servidor de e-mail',
    })

    await postJson(
      sd(workspace.id, 'change-windows'),
      { ...WINDOW, recurrence: { freq: 'WEEKLY', byDay: ['sat'] } },
      agent.cookie,
    )
    const freeze = (
      await (
        await postJson(
          sd(workspace.id, 'change-windows'),
          {
            name: 'Congelamento de outubro',
            kind: 'FREEZE',
            startsAt: '2026-10-01T00:00:00.000Z',
            endsAt: '2026-10-15T00:00:00.000Z',
          },
          agent.cookie,
        )
      ).json()
    ).data

    const planned = {
      plannedStartAt: new Date('2026-10-10T02:00:00.000Z'),
      plannedEndAt: new Date('2026-10-10T06:00:00.000Z'),
    }
    const one = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
      title: 'Troca de disco',
      configItemId: item.id,
      ...planned,
    })
    const two = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
      title: 'Atualização de firmware',
      configItemId: item.id,
      plannedStartAt: new Date('2026-10-10T05:00:00.000Z'),
      plannedEndAt: new Date('2026-10-10T09:00:00.000Z'),
    })

    const res = await getJson(
      sd(
        workspace.id,
        'change-calendar?from=2026-10-01T00:00:00.000Z&to=2026-11-01T00:00:00.000Z',
      ),
      agent.cookie,
    )
    expect(res.status).toBe(200)
    const calendar = (await res.json()).data
    // 5 sábados de outubro/2026 + a janela de congelamento.
    expect(calendar.windows).toHaveLength(6)
    expect(
      calendar.windows.filter((w: { recurring: boolean }) => w.recurring),
    ).toHaveLength(4)

    const entry = calendar.changes.find(
      (c: { ticketId: string }) => c.ticketId === one.id,
    )
    expect(entry.code).toMatch(/^CHG-/)
    expect(entry.configItemName).toBe('Servidor de e-mail')
    expect(entry.frozenWindowIds).toEqual([freeze.id])
    expect(entry.conflictTicketIds).toEqual([two.id])
  })

  it('refuses an inverted range and one over 400 days', async () => {
    const { agent, workspace } = await setup()
    const inverted = await getJson(
      sd(
        workspace.id,
        'change-calendar?from=2026-11-01T00:00:00.000Z&to=2026-10-01T00:00:00.000Z',
      ),
      agent.cookie,
    )
    expect(inverted.status).toBe(422)
    expect((await inverted.json()).error.code).toBe('VALIDATION_ERROR')

    const huge = await getJson(
      sd(
        workspace.id,
        'change-calendar?from=2026-01-01T00:00:00.000Z&to=2028-01-01T00:00:00.000Z',
      ),
      agent.cookie,
    )
    expect(huge.status).toBe(422)
    expect((await huge.json()).error.code).toBe('SD_CHANGE_WINDOW_INVALID')
  })
})

describe('ServiceDesk change schedule guard', () => {
  it('warns on a freeze and lets an admin confirm', async () => {
    const { agent, workspace, flow } = await setup()
    await postJson(
      sd(workspace.id, 'change-windows'),
      {
        name: 'Congelamento de outubro',
        kind: 'FREEZE',
        startsAt: '2026-10-01T00:00:00.000Z',
        endsAt: '2026-10-15T00:00:00.000Z',
      },
      agent.cookie,
    )
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
      title: 'Mudança congelada',
    })
    const base = sd(workspace.id, `tickets/${ticket.id}`)
    const schedule = {
      plannedStartAt: '2026-10-10T02:00:00.000Z',
      plannedEndAt: '2026-10-10T06:00:00.000Z',
    }

    const blocked = await patchJson(base, schedule, agent.cookie)
    expect(blocked.status).toBe(409)
    const body = await blocked.json()
    expect(body.error.code).toBe('SD_CHANGE_FROZEN')
    expect(body.error.details.warnings[0].kind).toBe('FREEZE')

    const confirmed = await patchJson(
      base,
      { ...schedule, confirmChangeSchedule: true },
      agent.cookie,
    )
    expect(confirmed.status).toBe(200)
    const forced = await prisma.sdTicketEvent.findFirst({
      where: { ticketId: ticket.id, action: 'change.schedule_forced' },
    })
    expect(forced).not.toBeNull()

    const panel = await getJson(`${base}/change-schedule`, agent.cookie)
    expect(panel.status).toBe(200)
    const data = (await panel.json()).data
    expect(data.plannedStartAt).toBe(schedule.plannedStartAt)
    expect(data.warnings[0].kind).toBe('FREEZE')
    expect(data.windows).toHaveLength(1)
  })

  it('warns on a rival change sharing the config item', async () => {
    const { agent, workspace, flow } = await setup()
    const item = await seedSdConfigItem(workspace.id, agent.id)
    await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
      title: 'Já agendada',
      configItemId: item.id,
      plannedStartAt: new Date('2026-10-10T02:00:00.000Z'),
      plannedEndAt: new Date('2026-10-10T06:00:00.000Z'),
    })
    const mine = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
      title: 'Nova',
      configItemId: item.id,
    })

    const res = await patchJson(
      sd(workspace.id, `tickets/${mine.id}`),
      {
        plannedStartAt: '2026-10-10T04:00:00.000Z',
        plannedEndAt: '2026-10-10T08:00:00.000Z',
      },
      agent.cookie,
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('SD_CHANGE_CONFLICT')
  })
})

describe('ServiceDesk CAB boards', () => {
  it('creates, lists, updates and deletes a committee', async () => {
    const { agent, workspace, requester } = await setup()

    const created = await postJson(
      sd(workspace.id, 'cab-boards'),
      {
        name: 'CAB de infraestrutura',
        quorum: 0,
        conditions: [
          { field: 'changeRisk', operator: 'in', value: ['HIGH', 'VERY_HIGH'] },
        ],
        members: [
          { userId: agent.id, required: true },
          { userId: requester.id },
        ],
      },
      agent.cookie,
    )
    expect(created.status).toBe(201)
    const board = (await created.json()).data
    expect(board).toMatchObject({ quorum: 0, effectiveQuorum: 2 })
    expect(board.members).toHaveLength(2)
    expect(board.members[0].required).toBe(true)
    expect(board.members[0].user.id).toBe(agent.id)

    const list = await getJson(sd(workspace.id, 'cab-boards'), agent.cookie)
    expect((await list.json()).data).toHaveLength(1)

    const updated = await patchJson(
      sd(workspace.id, `cab-boards/${board.id}`),
      { quorum: 1, members: [{ userId: agent.id, required: false }] },
      agent.cookie,
    )
    expect(updated.status).toBe(200)
    expect((await updated.json()).data).toMatchObject({
      quorum: 1,
      effectiveQuorum: 1,
    })

    const removed = await deleteJson(
      sd(workspace.id, `cab-boards/${board.id}`),
      agent.cookie,
    )
    expect(removed.status).toBe(200)
    const after = await getJson(
      sd(workspace.id, 'cab-boards?includeInactive=true'),
      agent.cookie,
    )
    expect((await after.json()).data).toHaveLength(0)
  })

  it('refuses a quorum that does not fit and a member from outside', async () => {
    const { agent, workspace } = await setup()
    const outsider = await createAuthenticatedUser()

    const tooBig = await postJson(
      sd(workspace.id, 'cab-boards'),
      { name: 'CAB', quorum: 3, members: [{ userId: agent.id }] },
      agent.cookie,
    )
    expect(tooBig.status).toBe(422)
    expect((await tooBig.json()).error.code).toBe('SD_CAB_QUORUM_INVALID')

    const empty = await postJson(
      sd(workspace.id, 'cab-boards'),
      { name: 'CAB', members: [] },
      agent.cookie,
    )
    expect(empty.status).toBe(422)
    expect((await empty.json()).error.code).toBe('SD_CAB_QUORUM_INVALID')

    const stranger = await postJson(
      sd(workspace.id, 'cab-boards'),
      { name: 'CAB', members: [{ userId: outsider.id }] },
      agent.cookie,
    )
    expect(stranger.status).toBe(404)
    expect((await stranger.json()).error.code).toBe('SD_CONFIG_NOT_FOUND')
  })
})

describe('ServiceDesk approval rounds', () => {
  it('opens a round, counts the quorum and unlocks the phase', async () => {
    const { agent, workspace, requester, flow } = await setup()
    await prisma.sdPhase.update({
      where: { id: flow.inProgress.id },
      data: { requiresApproval: true },
    })
    const board = (
      await (
        await postJson(
          sd(workspace.id, 'cab-boards'),
          {
            name: 'CAB padrão',
            quorum: 2,
            members: [{ userId: agent.id }, { userId: requester.id }],
          },
          agent.cookie,
        )
      ).json()
    ).data
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
      title: 'Mudança com comitê',
    })
    const base = sd(workspace.id, `tickets/${ticket.id}`)

    // A fase exige aprovação e ainda não há nenhuma.
    const blocked = await postJson(
      `${base}/phase`,
      { phaseId: flow.inProgress.id },
      agent.cookie,
    )
    expect(blocked.status).toBe(422)
    expect((await blocked.json()).error.code).toBe('SD_APPROVAL_REQUIRED')

    const opened = await postJson(
      `${base}/approval-rounds`,
      { message: 'Aprovar a janela de sábado' },
      agent.cookie,
    )
    expect(opened.status).toBe(201)
    const round = (await opened.json()).data
    expect(round).toMatchObject({
      boardId: board.id,
      boardName: 'CAB padrão',
      status: 'PENDING',
      quorum: 2,
    })
    expect(round.approvals).toHaveLength(2)
    expect(round.tally).toMatchObject({ pending: 2, remaining: 2 })

    // Uma segunda rodada é recusada.
    const again = await postJson(`${base}/approval-rounds`, {}, agent.cookie)
    expect(again.status).toBe(409)
    expect((await again.json()).error.code).toBe('SD_APPROVAL_ROUND_CLOSED')

    // Primeiro voto: não fecha nada (quórum 2) nem cancela o irmão.
    const first = await respond(round.approvals[0].id, 'APPROVED')
    expect(first.status).toBe(200)
    const midway = await getJson(`${base}/approval-rounds`, agent.cookie)
    const pendingRound = (await midway.json()).data[0]
    expect(pendingRound.status).toBe('PENDING')
    expect(pendingRound.tally).toMatchObject({
      approved: 1,
      pending: 1,
      remaining: 1,
    })

    // Segundo voto: bate o quórum e a rodada fecha.
    expect((await respond(round.approvals[1].id, 'APPROVED')).status).toBe(200)
    const closed = await getJson(`${base}/approval-rounds`, agent.cookie)
    const finalRound = (await closed.json()).data[0]
    expect(finalRound.status).toBe('APPROVED')
    expect(finalRound.decidedAt).not.toBeNull()

    // A rodada aprovada libera a fase que exige aprovação.
    const moved = await postJson(
      `${base}/phase`,
      { phaseId: flow.inProgress.id },
      agent.cookie,
    )
    expect(moved.status).toBe(200)
  })

  it('rejects the round on the first rejection and can be canceled', async () => {
    const { agent, workspace, requester, flow } = await setup()
    await postJson(
      sd(workspace.id, 'cab-boards'),
      {
        name: 'CAB',
        quorum: 2,
        members: [{ userId: agent.id }, { userId: requester.id }],
      },
      agent.cookie,
    )
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
    })
    const base = sd(workspace.id, `tickets/${ticket.id}`)

    const round = (
      await (await postJson(`${base}/approval-rounds`, {}, agent.cookie)).json()
    ).data
    expect((await respond(round.approvals[0].id, 'REJECTED')).status).toBe(200)
    const after = (
      await (await getJson(`${base}/approval-rounds`, agent.cookie)).json()
    ).data[0]
    expect(after.status).toBe('REJECTED')
    expect(after.tally.pending).toBe(0)

    // Já decidida: cancelar recusa.
    const canceled = await deleteJson(
      `${base}/approval-rounds/${round.id}`,
      agent.cookie,
    )
    expect(canceled.status).toBe(409)
    expect((await canceled.json()).error.code).toBe('SD_APPROVAL_ROUND_CLOSED')

    const second = (
      await (await postJson(`${base}/approval-rounds`, {}, agent.cookie)).json()
    ).data
    const ok = await deleteJson(
      `${base}/approval-rounds/${second.id}`,
      agent.cookie,
    )
    expect(ok.status).toBe(200)
    expect((await ok.json()).data.status).toBe('CANCELED')
    expect(
      await prisma.sdTicketApproval.count({
        where: { roundId: second.id, status: 'PENDING' },
      }),
    ).toBe(0)
  })

  it('explains when no committee serves the ticket, and is agent-only', async () => {
    const { agent, workspace, requester, flow } = await setup()
    const ticket = await seedSdTicket(workspace.id, flow.initial.id, {
      type: 'CHANGE',
    })
    const base = sd(workspace.id, `tickets/${ticket.id}`)

    const none = await postJson(`${base}/approval-rounds`, {}, agent.cookie)
    expect(none.status).toBe(404)
    expect((await none.json()).error.code).toBe('SD_CAB_BOARD_NOT_FOUND')

    const asRequester = await getJson(
      `${base}/approval-rounds`,
      requester.cookie,
    )
    expect(asRequester.status).toBe(403)
    expect((await asRequester.json()).error.code).toBe('SD_NOT_AGENT')
  })
})

/**
 * Responde um pedido pelo link público. O token cru nunca é persistido (só o
 * SHA-256), então o teste gera o seu, grava o hash no pedido e usa o par.
 */
async function respond(approvalId: string, decision: string) {
  const token = randomBytes(32).toString('base64url')
  await prisma.sdTicketApproval.update({
    where: { id: approvalId },
    data: { tokenHash: createHash('sha256').update(token).digest('hex') },
  })
  return postJson(`/api/servicedesk/approvals/${token}`, { decision })
}
