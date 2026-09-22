import { describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdAccessRepository } from '../sd-access.repository'

describe('SdAccessRepository.listDepartmentLinks', () => {
  it('returns only active, non-deleted departments of the workspace', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const parent = await prisma.sdDepartment.create({
      data: { workspaceId: workspace.id, name: 'Infra' },
    })
    const child = await prisma.sdDepartment.create({
      data: { workspaceId: workspace.id, name: 'Redes', parentId: parent.id },
    })
    const deleted = await prisma.sdDepartment.create({
      data: { workspaceId: workspace.id, name: 'Old', deletedAt: new Date() },
    })
    const inactive = await prisma.sdDepartment.create({
      data: { workspaceId: workspace.id, name: 'Off', active: false },
    })
    const foreign = await prisma.sdDepartment.create({
      data: { workspaceId: other.id, name: 'Outro' },
    })
    await prisma.sdDepartmentMember.createMany({
      data: [
        { departmentId: parent.id, userId: user.id, isLead: true },
        { departmentId: child.id, userId: user.id },
        { departmentId: deleted.id, userId: user.id },
        { departmentId: inactive.id, userId: user.id },
        { departmentId: foreign.id, userId: user.id },
      ],
    })

    const links = expectOk(
      await SdAccessRepository.listDepartmentLinks(user.id, workspace.id),
    )
    expect(
      links.sort((a, b) => a.departmentId.localeCompare(b.departmentId)),
    ).toEqual(
      [
        { departmentId: parent.id, parentId: null, isLead: true },
        { departmentId: child.id, parentId: parent.id, isLead: false },
      ].sort((a, b) => a.departmentId.localeCompare(b.departmentId)),
    )
  })

  it('returns DATABASE_ERROR when the query fails', async () => {
    vi.spyOn(prisma.sdDepartmentMember, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await SdAccessRepository.listDepartmentLinks('u', 'w'),
      'DATABASE_ERROR',
    )
  })
})
