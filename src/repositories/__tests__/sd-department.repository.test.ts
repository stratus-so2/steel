import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdDepartmentRepository } from '../sd-department.repository'

describe('SdDepartmentRepository', () => {
  it('creates roots and children with positions per parent and lists active ones', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const sd = expectOk(
      await SdDepartmentRepository.create(workspace.id, {
        name: 'Service Desk',
      }),
    )
    const infra = expectOk(
      await SdDepartmentRepository.create(workspace.id, {
        name: 'Infra',
        active: false,
      }),
    )
    const n1 = expectOk(
      await SdDepartmentRepository.create(workspace.id, {
        name: 'N1',
        parentId: sd.id,
      }),
    )
    expect([sd.position, infra.position, n1.position]).toEqual([0, 1, 0])
    expect(n1.members).toEqual([])

    const active = expectOk(await SdDepartmentRepository.list(workspace.id))
    // Mesma posição (0) em níveis diferentes: desempata pelo nome.
    expect(active.map((d) => d.name)).toEqual(['N1', 'Service Desk'])
    const all = expectOk(
      await SdDepartmentRepository.list(workspace.id, {
        includeInactive: true,
      }),
    )
    expect(all).toHaveLength(3)
    expect(expectOk(await SdDepartmentRepository.list(other.id))).toEqual([])

    expect(expectOk(await SdDepartmentRepository.countChildren(sd.id))).toBe(1)
    expectErr(
      await SdDepartmentRepository.findById(sd.id, other.id),
      'SD_DEPARTMENT_NOT_FOUND',
    )

    const updated = expectOk(
      await SdDepartmentRepository.update(infra.id, workspace.id, {
        active: true,
        color: '#ff0000',
      }),
    )
    expect(updated.color).toBe('#ff0000')

    expectOk(
      await SdDepartmentRepository.reorder(workspace.id, [infra.id, sd.id]),
    )
    const reordered = expectOk(await SdDepartmentRepository.list(workspace.id))
    expect(reordered[0].id).toBe(infra.id)
  })

  it('manages members (upsert, lead flag, removal)', async () => {
    const [workspace, user, other] = await Promise.all([
      seedWorkspace(),
      seedUser({ name: 'Ana' }),
      seedUser({ name: 'Bruno' }),
    ])
    const dept = expectOk(
      await SdDepartmentRepository.create(workspace.id, { name: 'N1' }),
    )
    expectOk(
      await SdDepartmentRepository.upsertMember(dept.id, other.id, false),
    )
    expectOk(await SdDepartmentRepository.upsertMember(dept.id, user.id, false))
    expectOk(await SdDepartmentRepository.upsertMember(dept.id, user.id, true))

    const found = expectOk(
      await SdDepartmentRepository.findById(dept.id, workspace.id),
    )
    expect(found.members.map((m) => [m.user.name, m.isLead])).toEqual([
      ['Ana', true],
      ['Bruno', false],
    ])

    expectOk(await SdDepartmentRepository.updateMember(dept.id, user.id, false))
    expectOk(await SdDepartmentRepository.removeMember(dept.id, other.id))
    const after = expectOk(
      await SdDepartmentRepository.findById(dept.id, workspace.id),
    )
    expect(after.members.map((m) => [m.userId, m.isLead])).toEqual([
      [user.id, false],
    ])

    expectErr(
      await SdDepartmentRepository.removeMember(dept.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdDepartmentRepository.updateMember(dept.id, other.id, true),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('soft-deletes the department with its children and clears the default', async () => {
    const workspace = await seedWorkspace()
    const root = expectOk(
      await SdDepartmentRepository.create(workspace.id, { name: 'SD' }),
    )
    const child = expectOk(
      await SdDepartmentRepository.create(workspace.id, {
        name: 'N1',
        parentId: root.id,
      }),
    )
    const keep = expectOk(
      await SdDepartmentRepository.create(workspace.id, { name: 'Infra' }),
    )
    await prisma.sdSettings.create({
      data: {
        workspaceId: workspace.id,
        ticketPrefixes: {},
        defaultDepartmentId: child.id,
      },
    })

    expectOk(await SdDepartmentRepository.softDelete(root.id, workspace.id))

    const list = expectOk(
      await SdDepartmentRepository.list(workspace.id, {
        includeInactive: true,
      }),
    )
    expect(list.map((d) => d.id)).toEqual([keep.id])
    const settings = await prisma.sdSettings.findUniqueOrThrow({
      where: { workspaceId: workspace.id },
    })
    expect(settings.defaultDepartmentId).toBeNull()
  })

  it('rejects foreign ids on update/reorder', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const dept = expectOk(
      await SdDepartmentRepository.create(workspace.id, { name: 'SD' }),
    )
    expectErr(
      await SdDepartmentRepository.update(dept.id, other.id, { name: 'x' }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await SdDepartmentRepository.reorder(other.id, [dept.id]),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})
