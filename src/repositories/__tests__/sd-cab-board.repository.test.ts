import { describe, expect, it } from 'vitest'
import {
  seedSdCabBoard,
  seedSdCabMember,
} from '@/src/__tests__/factories/sd-change.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdCabBoardRepository } from '../sd-cab-board.repository'

async function setup() {
  const [workspace, other, admin, ana, bruno] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
    seedUser(),
    seedUser(),
  ])
  return { workspace, other, admin, ana, bruno }
}

describe('SdCabBoardRepository', () => {
  it('lists active boards by position with the members ordered', async () => {
    const { workspace, admin, ana, bruno } = await setup()
    const second = await seedSdCabBoard(workspace.id, admin.id, {
      name: 'Segundo',
      position: 1,
    })
    const first = await seedSdCabBoard(workspace.id, admin.id, {
      name: 'Primeiro',
      position: 0,
    })
    await seedSdCabBoard(workspace.id, admin.id, {
      name: 'Inativo',
      active: false,
    })
    await seedSdCabBoard(workspace.id, admin.id, {
      name: 'Excluído',
      deletedAt: new Date(),
    })
    await seedSdCabMember(first.id, ana.id, false)
    await seedSdCabMember(first.id, bruno.id, true)

    const rows = expectOk(await SdCabBoardRepository.list(workspace.id))
    expect(rows.map((r) => r.id)).toEqual([first.id, second.id])
    // Obrigatórios primeiro.
    expect(rows[0]?.members.map((m) => m.userId)).toEqual([bruno.id, ana.id])
    expect(rows[0]?.members[0]?.user?.id).toBe(bruno.id)
  })

  it('includes inactive boards on demand but never the deleted ones', async () => {
    const { workspace, admin } = await setup()
    await seedSdCabBoard(workspace.id, admin.id, {
      name: 'Inativo',
      active: false,
    })
    await seedSdCabBoard(workspace.id, admin.id, {
      name: 'Excluído',
      deletedAt: new Date(),
    })

    const rows = expectOk(
      await SdCabBoardRepository.list(workspace.id, { includeInactive: true }),
    )
    expect(rows.map((r) => r.name)).toEqual(['Inativo'])
  })

  it('finds by id and rejects another workspace', async () => {
    const { workspace, other, admin } = await setup()
    const board = await seedSdCabBoard(workspace.id, admin.id)

    expect(
      expectOk(await SdCabBoardRepository.findById(board.id, workspace.id))
        .name,
    ).toBe('CAB de infraestrutura')
    expect(
      expectErr(await SdCabBoardRepository.findById(board.id, other.id)).code,
    ).toBe('SD_CAB_BOARD_NOT_FOUND')
  })

  it('creates with members, conditions and the next position', async () => {
    const { workspace, admin, ana, bruno } = await setup()
    await seedSdCabBoard(workspace.id, admin.id, { name: 'Já existe' })

    const created = expectOk(
      await SdCabBoardRepository.create(workspace.id, admin.id, {
        name: 'CAB de rede',
        quorum: 2,
        rejectEnds: false,
        conditions: [
          { field: 'changeRisk', operator: 'equals', value: 'HIGH' },
        ],
        members: [
          { userId: ana.id, required: true },
          { userId: bruno.id, required: false },
        ],
      }),
    )
    expect(created.position).toBe(1)
    expect(created.quorum).toBe(2)
    expect(created.rejectEnds).toBe(false)
    expect(created.conditions).toEqual([
      { field: 'changeRisk', operator: 'equals', value: 'HIGH' },
    ])
    expect(created.members).toHaveLength(2)
    expect(created.members[0]?.required).toBe(true)
  })

  it('honours an explicit position on create', async () => {
    const { workspace, admin } = await setup()
    const created = expectOk(
      await SdCabBoardRepository.create(workspace.id, admin.id, {
        name: 'CAB fixo',
        position: 7,
        members: [],
      }),
    )
    expect(created.position).toBe(7)
  })

  it('replaces the whole member list on update', async () => {
    const { workspace, admin, ana, bruno } = await setup()
    const board = expectOk(
      await SdCabBoardRepository.create(workspace.id, admin.id, {
        name: 'CAB',
        members: [{ userId: ana.id, required: false }],
      }),
    )

    const updated = expectOk(
      await SdCabBoardRepository.update(board.id, workspace.id, {
        name: 'CAB renomeado',
        quorum: 1,
        members: [{ userId: bruno.id, required: true }],
      }),
    )
    expect(updated.name).toBe('CAB renomeado')
    expect(updated.members.map((m) => m.userId)).toEqual([bruno.id])
    expect(
      await prisma.sdCabMember.count({ where: { boardId: board.id } }),
    ).toBe(1)
  })

  it('keeps the members when the update omits them', async () => {
    const { workspace, admin, ana } = await setup()
    const board = expectOk(
      await SdCabBoardRepository.create(workspace.id, admin.id, {
        name: 'CAB',
        members: [{ userId: ana.id, required: false }],
      }),
    )

    const updated = expectOk(
      await SdCabBoardRepository.update(board.id, workspace.id, {
        active: false,
      }),
    )
    expect(updated.active).toBe(false)
    expect(updated.members.map((m) => m.userId)).toEqual([ana.id])
  })

  it('soft-deletes and deactivates', async () => {
    const { workspace, admin } = await setup()
    const board = await seedSdCabBoard(workspace.id, admin.id)
    expectOk(await SdCabBoardRepository.softDelete(board.id, workspace.id))

    const row = await prisma.sdCabBoard.findUniqueOrThrow({
      where: { id: board.id },
    })
    expect(row.deletedAt).not.toBeNull()
    expect(row.active).toBe(false)
  })

  it('maps a missing target to SD_CONFIG_NOT_FOUND', async () => {
    const { workspace } = await setup()
    expect(
      expectErr(
        await SdCabBoardRepository.update('nope', workspace.id, { quorum: 1 }),
      ).code,
    ).toBe('SD_CONFIG_NOT_FOUND')
    expect(
      expectErr(await SdCabBoardRepository.softDelete('nope', workspace.id))
        .code,
    ).toBe('SD_CONFIG_NOT_FOUND')
  })
})
