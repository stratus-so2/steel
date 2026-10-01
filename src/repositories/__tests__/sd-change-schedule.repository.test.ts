import { describe, expect, it } from 'vitest'
import { seedSdConfigItem } from '@/src/__tests__/factories/sd-config-item.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SdChangeScheduleRepository } from '../sd-change-schedule.repository'

const at = (iso: string) => new Date(iso)

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  const [phase, closed] = await Promise.all([
    seedSdPhase(workspace.id, {
      ticketType: 'CHANGE',
      name: 'Planejada',
      category: 'IN_PROGRESS',
    }),
    seedSdPhase(workspace.id, {
      ticketType: 'CHANGE',
      name: 'Encerrada',
      category: 'CLOSED',
    }),
  ])
  const item = await seedSdConfigItem(workspace.id, user.id, {
    name: 'Servidor de e-mail',
  })
  return { workspace, other, user, phase, closed, item }
}

const WINDOW = {
  plannedStartAt: at('2026-10-10T02:00:00.000Z'),
  plannedEndAt: at('2026-10-10T06:00:00.000Z'),
}

describe('SdChangeScheduleRepository', () => {
  it('lists the changes whose planned window crosses the range', async () => {
    const { workspace, phase, item } = await setup()
    const inside = await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      title: 'Troca de disco',
      configItemId: item.id,
      changeType: 'NORMAL',
      changeRisk: 'HIGH',
      ...WINDOW,
    })
    await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      title: 'Fora do intervalo',
      plannedStartAt: at('2026-12-01T02:00:00.000Z'),
      plannedEndAt: at('2026-12-01T06:00:00.000Z'),
    })
    await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      title: 'Sem janela',
    })
    await seedSdTicket(workspace.id, phase.id, {
      type: 'INCIDENT',
      title: 'Incidente com janela',
      ...WINDOW,
    })
    await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      title: 'Excluída',
      deletedAt: new Date(),
      ...WINDOW,
    })

    const rows = expectOk(
      await SdChangeScheduleRepository.listInRange(workspace.id, {
        from: at('2026-10-01T00:00:00.000Z'),
        to: at('2026-11-01T00:00:00.000Z'),
      }),
    )
    expect(rows.map((r) => r.id)).toEqual([inside.id])
    expect(rows[0]).toMatchObject({
      title: 'Troca de disco',
      changeRisk: 'HIGH',
      changeType: 'NORMAL',
    })
    expect(rows[0]?.configItem?.name).toBe('Servidor de e-mail')
    expect(rows[0]?.phase.category).toBe('IN_PROGRESS')
  })

  it('keeps closed changes in the calendar and orders by planned start', async () => {
    const { workspace, phase, closed } = await setup()
    const later = await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      plannedStartAt: at('2026-10-20T02:00:00.000Z'),
      plannedEndAt: at('2026-10-20T06:00:00.000Z'),
    })
    const earlier = await seedSdTicket(workspace.id, closed.id, {
      type: 'CHANGE',
      ...WINDOW,
    })

    const rows = expectOk(
      await SdChangeScheduleRepository.listInRange(workspace.id, {
        from: at('2026-10-01T00:00:00.000Z'),
        to: at('2026-11-01T00:00:00.000Z'),
      }),
    )
    expect(rows.map((r) => r.id)).toEqual([earlier.id, later.id])
  })

  it('scopes the listing to the workspace', async () => {
    const { workspace, other, user } = await setup()
    const phase = await seedSdPhase(other.id, { ticketType: 'CHANGE' })
    await seedSdTicket(other.id, phase.id, { type: 'CHANGE', ...WINDOW })
    expect(
      expectOk(
        await SdChangeScheduleRepository.listInRange(workspace.id, {
          from: at('2026-10-01T00:00:00.000Z'),
          to: at('2026-11-01T00:00:00.000Z'),
        }),
      ),
    ).toEqual([])
    expect(user.id).toBeTruthy()
  })

  it('finds another active change on the same config item', async () => {
    const { workspace, phase, item } = await setup()
    const mine = await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      configItemId: item.id,
      ...WINDOW,
    })
    const rival = await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      title: 'Mesma janela',
      configItemId: item.id,
      plannedStartAt: at('2026-10-10T05:00:00.000Z'),
      plannedEndAt: at('2026-10-10T09:00:00.000Z'),
    })

    const rows = expectOk(
      await SdChangeScheduleRepository.findConflicts({
        workspaceId: workspace.id,
        ticketId: mine.id,
        configItemId: item.id,
        startsAt: WINDOW.plannedStartAt,
        endsAt: WINDOW.plannedEndAt,
      }),
    )
    expect(rows.map((r) => r.id)).toEqual([rival.id])
  })

  it('ignores closed changes, other items and touching borders', async () => {
    const { workspace, user, phase, closed, item } = await setup()
    const mine = await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      configItemId: item.id,
      ...WINDOW,
    })
    await seedSdTicket(workspace.id, closed.id, {
      type: 'CHANGE',
      title: 'Encerrada',
      configItemId: item.id,
      ...WINDOW,
    })
    const otherItem = await seedSdConfigItem(workspace.id, user.id)
    await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      title: 'Outro item',
      configItemId: otherItem.id,
      ...WINDOW,
    })
    await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      title: 'Colada na borda',
      configItemId: item.id,
      plannedStartAt: WINDOW.plannedEndAt,
      plannedEndAt: at('2026-10-10T08:00:00.000Z'),
    })

    expect(
      expectOk(
        await SdChangeScheduleRepository.findConflicts({
          workspaceId: workspace.id,
          ticketId: mine.id,
          configItemId: item.id,
          startsAt: WINDOW.plannedStartAt,
          endsAt: WINDOW.plannedEndAt,
        }),
      ),
    ).toEqual([])
  })

  it('has no conflict to look for without a config item', async () => {
    const { workspace, phase } = await setup()
    const mine = await seedSdTicket(workspace.id, phase.id, {
      type: 'CHANGE',
      ...WINDOW,
    })
    expect(
      expectOk(
        await SdChangeScheduleRepository.findConflicts({
          workspaceId: workspace.id,
          ticketId: mine.id,
          configItemId: null,
          startsAt: WINDOW.plannedStartAt,
          endsAt: WINDOW.plannedEndAt,
        }),
      ),
    ).toEqual([])
  })

  it('reads the config item name', async () => {
    const { workspace, user } = await setup()
    const item = await seedSdConfigItem(workspace.id, user.id, {
      name: 'Firewall',
    })
    expect(
      expectOk(await SdChangeScheduleRepository.findConfigItemName(item.id)),
    ).toBe('Firewall')
    expect(
      expectOk(await SdChangeScheduleRepository.findConfigItemName('nope')),
    ).toBeNull()
  })
})
