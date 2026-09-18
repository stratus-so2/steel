import { describe, expect, it } from 'vitest'
import {
  seedCrmOpportunity,
  seedCrmOpportunityLineItem,
} from '@/src/__tests__/factories/crm-opportunity.factory'
import {
  seedCrmPipeline,
  seedCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { prisma } from '@/src/lib/prisma'
import {
  gatherWorkspaceData,
  purgeWorkspaceRows,
  restoreWorkspaceSnapshot,
} from '../workspace-snapshot'

async function seedWorkspaceWithCrm() {
  const user = await seedUser()
  const workspace = await seedWorkspace()
  await seedMembership({
    userId: user.id,
    workspaceId: workspace.id,
    role: 'OWNER',
  })
  const pipeline = await seedCrmPipeline(workspace.id, user.id)
  const stage = await seedCrmPipelineStage(pipeline.id)
  const opportunity = await seedCrmOpportunity(
    workspace.id,
    user.id,
    pipeline.id,
    stage.id,
  )
  await seedCrmOpportunityLineItem(opportunity.id)
  return { user, workspace, pipeline, stage, opportunity }
}

/** Snapshot passa por JSON no backup real (datas viram string). */
const viaJson = <T>(value: T): T => JSON.parse(JSON.stringify(value))

describe('workspace snapshot', () => {
  it('gathers workspace-scoped tables and child tables without workspaceId', async () => {
    const { workspace, stage } = await seedWorkspaceWithCrm()
    const other = await seedWorkspace()

    const data = await gatherWorkspaceData(prisma, workspace.id)

    expect(data.workspace).toMatchObject({ id: workspace.id })
    expect(data.membership).toHaveLength(1)
    expect(data.crmOpportunity).toHaveLength(1)
    // Filhas: só chegam ao workspace pela relação.
    expect(data.crmPipelineStage).toEqual([
      expect.objectContaining({ id: stage.id }),
    ])
    expect(data.crmOpportunityLineItem).toHaveLength(1)
    // Registros de plataforma nunca entram no snapshot.
    expect(data).not.toHaveProperty('backup')
    expect(data).not.toHaveProperty('adminOperation')

    const empty = await gatherWorkspaceData(prisma, other.id)
    expect(empty.crmPipelineStage).toEqual([])
  })

  it('returns only a null workspace for an unknown id', async () => {
    expect(await gatherWorkspaceData(prisma, 'missing')).toEqual({
      workspace: null,
    })
  })

  it('purges a workspace with CRM data and keeps users, other workspaces and backups', async () => {
    const { workspace, user } = await seedWorkspaceWithCrm()
    const other = await seedWorkspace()
    await prisma.backup.create({
      data: { scope: 'WORKSPACE', workspaceId: workspace.id },
    })

    await prisma.$transaction((tx) => purgeWorkspaceRows(tx, workspace.id))

    expect(
      await prisma.workspace.findUnique({ where: { id: workspace.id } }),
    ).toBeNull()
    expect(
      await prisma.crmPipelineStage.count({
        where: { pipeline: { workspaceId: workspace.id } },
      }),
    ).toBe(0)
    expect(await prisma.crmOpportunityLineItem.count()).toBe(0)
    // Usuário, outros workspaces e o registro de backup sobrevivem.
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBe(
      null,
    )
    expect(
      await prisma.workspace.findUnique({ where: { id: other.id } }),
    ).not.toBeNull()
    expect(
      await prisma.backup.count({ where: { workspaceId: workspace.id } }),
    ).toBe(1)
  })

  it('restores a deleted workspace from its snapshot, children included', async () => {
    const { workspace, opportunity } = await seedWorkspaceWithCrm()
    const data = viaJson(await gatherWorkspaceData(prisma, workspace.id))
    await prisma.$transaction((tx) => purgeWorkspaceRows(tx, workspace.id))

    const result = await restoreWorkspaceSnapshot(prisma, {
      workspaceId: workspace.id,
      data,
    })

    expect(result.rows).toBeGreaterThanOrEqual(5)
    const restored = await prisma.workspace.findUnique({
      where: { id: workspace.id },
    })
    expect(restored).toMatchObject({ slug: workspace.slug, status: 'ACTIVE' })
    expect(
      await prisma.crmOpportunity.findUnique({ where: { id: opportunity.id } }),
    ).not.toBeNull()
    expect(
      await prisma.crmOpportunityLineItem.count({
        where: { opportunityId: opportunity.id },
      }),
    ).toBe(1)
  })

  it('restores over the current state and reactivates a snapshot taken while DELETING', async () => {
    const { workspace } = await seedWorkspaceWithCrm()
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { status: 'DELETING' },
    })
    const data = viaJson(await gatherWorkspaceData(prisma, workspace.id))
    await prisma.crmOpportunity.deleteMany({
      where: { workspaceId: workspace.id },
    })

    await restoreWorkspaceSnapshot(prisma, { workspaceId: workspace.id, data })

    const restored = await prisma.workspace.findUnique({
      where: { id: workspace.id },
    })
    expect(restored?.status).toBe('ACTIVE')
    expect(
      await prisma.crmOpportunity.count({
        where: { workspaceId: workspace.id },
      }),
    ).toBe(1)
  })

  it('rolls back everything when a table cannot be restored', async () => {
    const { workspace } = await seedWorkspaceWithCrm()
    const data = viaJson(await gatherWorkspaceData(prisma, workspace.id))
    // Membro cujo usuário não existe mais → FK nunca satisfeita.
    const memberships = data.membership as Record<string, unknown>[]
    memberships[0] = { ...memberships[0], userId: 'deleted-user' }

    await expect(
      restoreWorkspaceSnapshot(prisma, { workspaceId: workspace.id, data }),
    ).rejects.toThrow(/membership/)

    // Estado anterior intacto.
    expect(
      await prisma.crmOpportunity.count({
        where: { workspaceId: workspace.id },
      }),
    ).toBe(1)
  })
})
