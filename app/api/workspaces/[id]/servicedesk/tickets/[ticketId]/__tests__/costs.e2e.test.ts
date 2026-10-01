import { describe, expect, it } from 'vitest'
import {
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { setupTabs, tabApi } from './sd-tab-e2e.helpers'

describe('ticket costs', () => {
  it('is agent-only', async () => {
    const { workspace, requester, ticket } = await setupTabs()
    const res = await getJson(
      `${tabApi(workspace.id, ticket.id)}/costs`,
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('records costs and totals them by category and billing', async () => {
    const { workspace, agent, ticket, other } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)

    const labor = await postJson(
      `${base}/costs`,
      {
        category: 'LABOR',
        description: 'Visita técnica',
        quantity: '1,5',
        unitCost: '150',
        billable: true,
        userId: agent.id,
      },
      agent.cookie,
    )
    expect(labor.status).toBe(201)
    const l = (await labor.json()).data
    expect(l.quantity).toBe('1.50')
    expect(l.total).toBe('225.00')
    expect(l.user.id).toBe(agent.id)

    const travel = (
      await (
        await postJson(
          `${base}/costs`,
          { category: 'TRAVEL', description: 'Uber', unitCost: 32.4 },
          agent.cookie,
        )
      ).json()
    ).data
    expect(travel.total).toBe('32.40')

    const invalid = await postJson(
      `${base}/costs`,
      { description: 'x', unitCost: '-1' },
      agent.cookie,
    )
    expect(invalid.status).toBe(422)

    const list = (await (await getJson(`${base}/costs`, agent.cookie)).json())
      .data
    expect(list.items).toHaveLength(2)
    expect(list.summary).toEqual({
      total: '257.40',
      billable: '225.00',
      nonBillable: '32.40',
      byCategory: [
        { category: 'LABOR', total: '225.00' },
        { category: 'TRAVEL', total: '32.40' },
      ],
    })

    const edited = await patchJson(
      `${base}/costs/${travel.id}`,
      { billable: true, quantity: 2 },
      agent.cookie,
    )
    expect(edited.status).toBe(200)
    expect((await edited.json()).data.total).toBe('64.80')

    const cross = await deleteJson(
      `${tabApi(workspace.id, other.id)}/costs/${travel.id}`,
      agent.cookie,
    )
    expect(cross.status).toBe(404)
    expect((await cross.json()).error.code).toBe('SD_COST_NOT_FOUND')

    const removed = await deleteJson(`${base}/costs/${travel.id}`, agent.cookie)
    expect(removed.status).toBe(200)
    const after = (await (await getJson(`${base}/costs`, agent.cookie)).json())
      .data
    expect(after.summary.total).toBe('225.00')
  })
})
