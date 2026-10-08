import { describe, expect, it } from 'vitest'
import { seedSdTimeEntry } from '@/src/__tests__/factories/sd-contract.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  getJson,
} from '@/src/__tests__/helpers/e2e'

const HOUR = 60 * 60 * 1000

async function setup() {
  const { user, workspace } = await authenticatedOwner()
  const member = await addMember(workspace.id, 'MEMBER')
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id, {
    title: 'Roteador travando',
    assigneeId: member.id,
    resolvedAt: new Date(Date.now() - 2 * HOUR),
  })
  const start = new Date(Date.now() - 26 * HOUR)
  await seedSdTimeEntry(workspace.id, ticket.id, user.id, {
    startedAt: start,
    endedAt: new Date(start.getTime() + HOUR),
    minutes: 60,
    billable: true,
    source: 'TIMER',
  })
  await seedSdTimeEntry(workspace.id, ticket.id, member.id, {
    startedAt: start,
    endedAt: new Date(start.getTime() + HOUR / 2),
    minutes: 30,
    billable: false,
    source: 'MANUAL',
  })
  return { user, member, workspace, ticket }
}

describe('Work log routes', () => {
  it('lists everyone for the owner and only themselves for a member', async () => {
    const { user, member, workspace } = await setup()

    const all = await getJson(
      `/api/workspaces/${workspace.id}/worklogs?period=last_7_days`,
      user.cookie,
    )
    expect(all.status).toBe(200)
    const data = (await all.json()).data
    expect(data.total).toBe(2)
    expect(data.totals).toMatchObject({ minutes: 90, billableMinutes: 60 })
    expect(data.canViewTeam).toBe(true)
    expect(data.people).toHaveLength(2)
    expect(data.items[0].ticket.code).toMatch(/^INC-\d{6}$/)

    const filtered = await getJson(
      `/api/workspaces/${workspace.id}/worklogs?source=MANUAL`,
      user.cookie,
    )
    expect((await filtered.json()).data.total).toBe(1)

    const mine = await getJson(
      `/api/workspaces/${workspace.id}/worklogs`,
      member.cookie,
    )
    const own = (await mine.json()).data
    expect(own.total).toBe(1)
    expect(own.items[0].user.id).toBe(member.id)
    expect(own.people).toBeNull()

    const other = await getJson(
      `/api/workspaces/${workspace.id}/worklogs?userId=${user.id}`,
      member.cookie,
    )
    expect(other.status).toBe(403)
  })

  it('rejects bad filters and non-members', async () => {
    const { user, workspace } = await setup()
    const bad = await getJson(
      `/api/workspaces/${workspace.id}/worklogs?period=custom&from=2026-10-05`,
      user.cookie,
    )
    expect(bad.status).toBe(422)
    const { user: stranger } = await authenticatedOwner()
    const denied = await getJson(
      `/api/workspaces/${workspace.id}/worklogs`,
      stranger.cookie,
    )
    expect(denied.status).toBe(403)
  })

  it('downloads the filtered entries as CSV', async () => {
    const { user, workspace } = await setup()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/worklogs/export?billable=true`,
      user.cookie,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain(
      'registros-de-trabalho-',
    )
    const lines = (await res.text()).replace('﻿', '').trim().split('\r\n')
    expect(lines[0].startsWith('inicio,fim,minutos,horas,pessoa')).toBe(true)
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('Roteador travando')
  })

  it('returns the team indicators to the owner and the own ones to a member', async () => {
    const { user, member, workspace } = await setup()
    const team = await getJson(
      `/api/workspaces/${workspace.id}/worklogs/productivity?period=last_7_days`,
      user.cookie,
    )
    expect(team.status).toBe(200)
    const data = (await team.json()).data
    expect(data.team.current.serviceDesk.loggedMinutes).toBe(90)
    expect(data.team.current.serviceDesk.ticketsResolved).toBe(1)
    expect(data.people).toHaveLength(2)
    expect(data.modules).toEqual({
      serviceDesk: true,
      crm: true,
      communication: true,
    })

    const own = await getJson(
      `/api/workspaces/${workspace.id}/worklogs/productivity`,
      member.cookie,
    )
    const mine = (await own.json()).data
    expect(mine.team).toBeNull()
    expect(mine.people).toHaveLength(1)
    expect(mine.people[0].user.id).toBe(member.id)
    expect(mine.people[0].current.serviceDesk.ticketsResolved).toBe(1)

    const csv = await getJson(
      `/api/workspaces/${workspace.id}/worklogs/productivity/export`,
      user.cookie,
    )
    expect(csv.status).toBe(200)
    const lines = (await csv.text()).replace('﻿', '').trim().split('\r\n')
    expect(lines[0].startsWith('pessoa,email,periodo,de,ate')).toBe(true)
    // Team + 2 people, current and previous period each.
    expect(lines).toHaveLength(1 + 6)
  })
})
