import { describe, expect, it } from 'vitest'
import {
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'
import { setupTabs, tabApi } from './sd-tab-e2e.helpers'

async function stockOf(partId: string) {
  return (await prisma.sdPart.findUniqueOrThrow({ where: { id: partId } }))
    .stock
}

describe('ticket parts', () => {
  it('is agent-only', async () => {
    const { workspace, requester, ticket } = await setupTabs()
    const res = await postJson(
      `${tabApi(workspace.id, ticket.id)}/parts`,
      { name: 'Fonte' },
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('follows the status flow and moves the catalog stock', async () => {
    const { workspace, agent, ticket, other } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)
    const catalog = await prisma.sdPart.create({
      data: {
        workspaceId: workspace.id,
        name: 'Fusor HP',
        sku: 'FUS-01',
        unitCost: '320.00',
        stock: 3,
      },
    })

    const requested = await postJson(
      `${base}/parts`,
      { partId: catalog.id, quantity: 2 },
      agent.cookie,
    )
    expect(requested.status).toBe(201)
    const p = (await requested.json()).data
    expect(p.name).toBe('Fusor HP')
    expect(p.sku).toBe('FUS-01')
    expect(p.unitCost).toBe('320.00')
    expect(p.total).toBe('640.00')
    expect(p.status).toBe('REQUESTED')
    expect(p.catalogStock).toBe(3)
    expect(p.nextStatuses).toEqual(['RESERVED', 'INSTALLED', 'CANCELED'])

    const installed = await patchJson(
      `${base}/parts/${p.id}`,
      { status: 'INSTALLED', serialNumber: 'SN123' },
      agent.cookie,
    )
    expect(installed.status).toBe(200)
    expect((await installed.json()).data.catalogStock).toBe(1)
    expect(await stockOf(catalog.id)).toBe(1)

    const qty = await patchJson(
      `${base}/parts/${p.id}`,
      { quantity: 1 },
      agent.cookie,
    )
    expect(qty.status).toBe(422)

    const backwards = await patchJson(
      `${base}/parts/${p.id}`,
      { status: 'REQUESTED' },
      agent.cookie,
    )
    expect(backwards.status).toBe(422)
    expect((await backwards.json()).error.code).toBe('SD_PART_STATUS_INVALID')

    const returned = await patchJson(
      `${base}/parts/${p.id}`,
      { status: 'RETURNED' },
      agent.cookie,
    )
    expect(returned.status).toBe(200)
    expect(await stockOf(catalog.id)).toBe(3)

    const tooMany = await postJson(
      `${base}/parts`,
      { partId: catalog.id, quantity: 5, status: 'INSTALLED' },
      agent.cookie,
    )
    expect(tooMany.status).toBe(409)
    expect((await tooMany.json()).error.code).toBe('SD_PART_OUT_OF_STOCK')
    expect(await stockOf(catalog.id)).toBe(3)

    const direct = (
      await (
        await postJson(
          `${base}/parts`,
          { partId: catalog.id, quantity: 1, status: 'INSTALLED' },
          agent.cookie,
        )
      ).json()
    ).data
    expect(await stockOf(catalog.id)).toBe(2)
    // excluir peça instalada devolve ao estoque
    const removed = await deleteJson(`${base}/parts/${direct.id}`, agent.cookie)
    expect(removed.status).toBe(200)
    expect(await stockOf(catalog.id)).toBe(3)

    const free = (
      await (
        await postJson(
          `${base}/parts`,
          { name: 'Cabo USB', quantity: 2, unitCost: '15,50' },
          agent.cookie,
        )
      ).json()
    ).data
    expect(free.partId).toBeNull()
    expect(free.catalogStock).toBeNull()

    const list = (await (await getJson(`${base}/parts`, agent.cookie)).json())
      .data
    // devolvida não entra no total
    expect(list.summary).toEqual({
      total: '31.00',
      installed: '0.00',
      count: 1,
    })

    const missing = await postJson(
      `${base}/parts`,
      { partId: 'nope' },
      agent.cookie,
    )
    expect(missing.status).toBe(404)
    const noName = await postJson(`${base}/parts`, {}, agent.cookie)
    expect(noName.status).toBe(422)

    const cross = await patchJson(
      `${tabApi(workspace.id, other.id)}/parts/${free.id}`,
      { notes: 'x' },
      agent.cookie,
    )
    expect(cross.status).toBe(404)
    expect((await cross.json()).error.code).toBe('SD_TICKET_PART_NOT_FOUND')
  })
})
