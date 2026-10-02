import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { seedSdChangeWindow } from '@/src/__tests__/factories/sd-change.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdChangeWindowRepository } from '../sd-change-window.repository'

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

const at = (iso: string) => new Date(iso)

describe('SdChangeWindowRepository', () => {
  it('lists by start date, skipping soft-deleted windows', async () => {
    const { workspace, user } = await setup()
    await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Segunda',
      startsAt: at('2026-10-10T00:00:00.000Z'),
      endsAt: at('2026-10-10T02:00:00.000Z'),
    })
    await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Primeira',
      startsAt: at('2026-10-01T00:00:00.000Z'),
      endsAt: at('2026-10-01T02:00:00.000Z'),
    })
    const gone = await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Excluída',
      deletedAt: new Date(),
    })

    const rows = expectOk(await SdChangeWindowRepository.list(workspace.id))
    expect(rows.map((r) => r.name)).toEqual(['Primeira', 'Segunda'])
    expect(rows.every((r) => r.id !== gone.id)).toBe(true)
    expect(rows[0]?.createdBy?.id).toBe(user.id)
  })

  it('filters the listing by kind', async () => {
    const { workspace, user } = await setup()
    await seedSdChangeWindow(workspace.id, user.id, { name: 'Manutenção' })
    await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Congelamento',
      kind: 'FREEZE',
    })

    const freeze = expectOk(
      await SdChangeWindowRepository.list(workspace.id, { kind: 'FREEZE' }),
    )
    expect(freeze.map((r) => r.name)).toEqual(['Congelamento'])
  })

  it('scopes the listing to the workspace', async () => {
    const { workspace, other, user } = await setup()
    await seedSdChangeWindow(other.id, user.id, { name: 'De outra' })
    expect(expectOk(await SdChangeWindowRepository.list(workspace.id))).toEqual(
      [],
    )
  })

  it('listForRange keeps overlapping windows and every recurring one', async () => {
    const { workspace, user } = await setup()
    const inside = await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Dentro',
      startsAt: at('2026-10-05T00:00:00.000Z'),
      endsAt: at('2026-10-05T04:00:00.000Z'),
    })
    const before = await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Antes',
      startsAt: at('2026-01-01T00:00:00.000Z'),
      endsAt: at('2026-01-01T04:00:00.000Z'),
    })
    const recurring = await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Recorrente antiga',
      startsAt: at('2026-01-03T00:00:00.000Z'),
      endsAt: at('2026-01-03T04:00:00.000Z'),
      recurrence: { freq: 'WEEKLY', interval: 1, byDay: [] },
    })
    const after = await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Depois',
      startsAt: at('2027-01-01T00:00:00.000Z'),
      endsAt: at('2027-01-01T04:00:00.000Z'),
    })

    const rows = expectOk(
      await SdChangeWindowRepository.listForRange(workspace.id, {
        from: at('2026-10-01T00:00:00.000Z'),
        to: at('2026-11-01T00:00:00.000Z'),
      }),
    )
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(inside.id)
    expect(ids).toContain(recurring.id)
    expect(ids).not.toContain(before.id)
    expect(ids).not.toContain(after.id)
  })

  it('listForRange also filters by kind', async () => {
    const { workspace, user } = await setup()
    await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Manutenção',
      startsAt: at('2026-10-05T00:00:00.000Z'),
      endsAt: at('2026-10-05T04:00:00.000Z'),
    })
    const freeze = await seedSdChangeWindow(workspace.id, user.id, {
      name: 'Congelamento',
      kind: 'FREEZE',
      startsAt: at('2026-10-06T00:00:00.000Z'),
      endsAt: at('2026-10-06T04:00:00.000Z'),
    })

    const rows = expectOk(
      await SdChangeWindowRepository.listForRange(
        workspace.id,
        {
          from: at('2026-10-01T00:00:00.000Z'),
          to: at('2026-11-01T00:00:00Z'),
        },
        { kind: 'FREEZE' },
      ),
    )
    expect(rows.map((r) => r.id)).toEqual([freeze.id])
  })

  it('finds by id and rejects another workspace or a deleted window', async () => {
    const { workspace, other, user } = await setup()
    const window = await seedSdChangeWindow(workspace.id, user.id)

    const found = expectOk(
      await SdChangeWindowRepository.findById(window.id, workspace.id),
    )
    expect(found.name).toBe('Janela de manutenção')
    expect(
      expectErr(await SdChangeWindowRepository.findById(window.id, other.id))
        .code,
    ).toBe('SD_CHANGE_WINDOW_NOT_FOUND')

    expectOk(await SdChangeWindowRepository.softDelete(window.id, workspace.id))
    expect(
      expectErr(
        await SdChangeWindowRepository.findById(window.id, workspace.id),
      ).code,
    ).toBe('SD_CHANGE_WINDOW_NOT_FOUND')
    const row = await prisma.sdChangeWindow.findUniqueOrThrow({
      where: { id: window.id },
    })
    expect(row.deletedAt).not.toBeNull()
  })

  it('creates with the recurrence json and the defaults', async () => {
    const { workspace, user } = await setup()
    const created = expectOk(
      await SdChangeWindowRepository.create(workspace.id, user.id, {
        name: 'Congelamento de fim de ano',
        kind: 'FREEZE',
        startsAt: at('2026-12-20T00:00:00.000Z'),
        endsAt: at('2027-01-05T00:00:00.000Z'),
        recurrence: { freq: 'MONTHLY', interval: 12, byDay: [] },
        configItemIds: ['ci_1'],
        departmentIds: ['dep_1'],
        description: 'Nada entra em produção',
      }),
    )
    expect(created.kind).toBe('FREEZE')
    expect(created.timezone).toBe('America/Sao_Paulo')
    expect(created.recurrence).toEqual({
      freq: 'MONTHLY',
      interval: 12,
      byDay: [],
    })
    expect(created.configItemIds).toEqual(['ci_1'])
    expect(created.createdBy?.id).toBe(user.id)
  })

  it('updates fields and clears the recurrence with DbNull', async () => {
    const { workspace, user } = await setup()
    const window = await seedSdChangeWindow(workspace.id, user.id, {
      recurrence: { freq: 'WEEKLY', interval: 1, byDay: ['sat'] },
    })

    const updated = expectOk(
      await SdChangeWindowRepository.update(window.id, workspace.id, {
        name: 'Renomeada',
        recurrence: Prisma.DbNull,
        configItemIds: [],
      }),
    )
    expect(updated.name).toBe('Renomeada')
    expect(updated.recurrence).toBeNull()
  })

  it('maps a missing update target to SD_CONFIG_NOT_FOUND', async () => {
    const { workspace } = await setup()
    expect(
      expectErr(
        await SdChangeWindowRepository.update('nope', workspace.id, {
          name: 'X',
        }),
      ).code,
    ).toBe('SD_CONFIG_NOT_FOUND')
    expect(
      expectErr(await SdChangeWindowRepository.softDelete('nope', workspace.id))
        .code,
    ).toBe('SD_CONFIG_NOT_FOUND')
  })
})
