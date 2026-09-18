import { describe, expect, it, vi } from 'vitest'
import { seedCrmOpportunity } from '@/src/__tests__/factories/crm-opportunity.factory'
import {
  seedCrmPipeline,
  seedCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '../crm-pipeline.repository'

describe('CrmPipelineRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmPipeline(workspace.id, user.id)

      const result = await CrmPipelineRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Second',
      })

      const pipeline = expectOk(result)
      expect(pipeline.position).toBe(1)
    })
  })

  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted pipelines', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const active = await seedCrmPipeline(workspace.id, user.id)
      await seedCrmPipeline(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmPipelineRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.id)).toEqual([active.id])
    })
  })

  describe('findById()', () => {
    it('should return RESOURCE_NOT_FOUND for another workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const seeded = await seedCrmPipeline(workspaceA.id, user.id)

      expectErr(
        await CrmPipelineRepository.findById(seeded.id, workspaceB.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('reorder()', () => {
    it('should update positions to match the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmPipeline(workspace.id, user.id)
      const b = await seedCrmPipeline(workspace.id, user.id)

      expectOk(await CrmPipelineRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmPipelineRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.id)).toEqual([b.id, a.id])
    })
  })
})

describe('CrmPipelineStageRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the pipeline', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const pipeline = await seedCrmPipeline(workspace.id, user.id)
      await seedCrmPipelineStage(pipeline.id)

      const result = await CrmPipelineStageRepository.create({
        pipelineId: pipeline.id,
        name: 'Second',
      })

      const stage = expectOk(result)
      expect(stage.position).toBe(1)
    })
  })

  describe('listByPipeline()', () => {
    it('should list stages ordered by position', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const pipeline = await seedCrmPipeline(workspace.id, user.id)
      const a = await seedCrmPipelineStage(pipeline.id, { name: 'A' })
      const b = await seedCrmPipelineStage(pipeline.id, { name: 'B' })

      const list = expectOk(
        await CrmPipelineStageRepository.listByPipeline(pipeline.id),
      )
      expect(list.map((s) => s.id)).toEqual([a.id, b.id])
    })
  })

  describe('reorder()', () => {
    it('should update positions to match the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const pipeline = await seedCrmPipeline(workspace.id, user.id)
      const a = await seedCrmPipelineStage(pipeline.id)
      const b = await seedCrmPipelineStage(pipeline.id)

      expectOk(
        await CrmPipelineStageRepository.reorder(pipeline.id, [b.id, a.id]),
      )

      const list = expectOk(
        await CrmPipelineStageRepository.listByPipeline(pipeline.id),
      )
      expect(list.map((s) => s.id)).toEqual([b.id, a.id])
    })
  })
})

describe('CrmPipelineRepository (edge cases)', () => {
  it('should find an existing pipeline and the default one', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    await seedCrmPipeline(workspace.id, user.id)
    const def = await seedCrmPipeline(workspace.id, user.id, {
      isDefault: true,
    })
    await seedCrmPipeline(workspace.id, user.id, {
      isDefault: true,
      deletedAt: new Date(),
    })

    expect(
      expectOk(await CrmPipelineRepository.findById(def.id, workspace.id)).id,
    ).toBe(def.id)
    expect(
      expectOk(await CrmPipelineRepository.findDefault(workspace.id))?.id,
    ).toBe(def.id)
  })

  it('should return null when the workspace has no default pipeline', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    await seedCrmPipeline(workspace.id, user.id)

    expect(
      expectOk(await CrmPipelineRepository.findDefault(workspace.id)),
    ).toBeNull()
  })

  it('should update and soft delete a pipeline', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const pipeline = await seedCrmPipeline(workspace.id, user.id)

    const updated = expectOk(
      await CrmPipelineRepository.update(pipeline.id, {
        name: 'Renamed',
        isDefault: true,
        updatedById: user.id,
      }),
    )
    expect(updated).toMatchObject({ name: 'Renamed', isDefault: true })

    expectOk(await CrmPipelineRepository.softDelete(pipeline.id))
    expectErr(
      await CrmPipelineRepository.findById(pipeline.id, workspace.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should return DATABASE_ERROR for writes on a missing pipeline', async () => {
    expectErr(
      await CrmPipelineRepository.update('missing', { name: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmPipelineRepository.softDelete('missing'),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when creating for a missing workspace', async () => {
    const user = await seedUser()
    expectErr(
      await CrmPipelineRepository.create({
        workspaceId: 'missing',
        createdById: user.id,
        name: 'x',
      }),
      'DATABASE_ERROR',
    )
  })

  it('should not reorder pipelines of another workspace', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const foreign = await seedCrmPipeline(other.id, user.id)

    expectErr(
      await CrmPipelineRepository.reorder(workspace.id, [foreign.id]),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when read queries throw', async () => {
    vi.spyOn(prisma.crmPipeline, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmPipelineRepository.listByWorkspace('w'),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.crmPipeline, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(await CrmPipelineRepository.findById('p', 'w'), 'DATABASE_ERROR')

    vi.spyOn(prisma.crmPipeline, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(await CrmPipelineRepository.findDefault('w'), 'DATABASE_ERROR')
  })
})

describe('CrmPipelineStageRepository (edge cases)', () => {
  it('should find a stage only within its pipeline', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const pipeline = await seedCrmPipeline(workspace.id, user.id)
    const otherPipeline = await seedCrmPipeline(workspace.id, user.id)
    const stage = await seedCrmPipelineStage(pipeline.id)

    expect(
      expectOk(await CrmPipelineStageRepository.findById(stage.id, pipeline.id))
        .id,
    ).toBe(stage.id)
    expectErr(
      await CrmPipelineStageRepository.findById(stage.id, otherPipeline.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should update a stage', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const pipeline = await seedCrmPipeline(workspace.id, user.id)
    const stage = await seedCrmPipelineStage(pipeline.id)

    const updated = expectOk(
      await CrmPipelineStageRepository.update(stage.id, {
        name: 'Ganho',
        probability: 100,
        category: 'WON',
        color: '#00ff00',
      }),
    )
    expect(updated).toMatchObject({
      name: 'Ganho',
      probability: 100,
      category: 'WON',
      color: '#00ff00',
    })
  })

  it('should delete an unused stage', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const pipeline = await seedCrmPipeline(workspace.id, user.id)
    const stage = await seedCrmPipelineStage(pipeline.id)

    expectOk(await CrmPipelineStageRepository.delete(stage.id))
    expect(
      expectOk(await CrmPipelineStageRepository.listByPipeline(pipeline.id)),
    ).toEqual([])
  })

  it('should return CRM_PIPELINE_STAGE_IN_USE when opportunities reference the stage', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const pipeline = await seedCrmPipeline(workspace.id, user.id)
    const stage = await seedCrmPipelineStage(pipeline.id)
    await seedCrmOpportunity(workspace.id, user.id, pipeline.id, stage.id)

    expectErr(
      await CrmPipelineStageRepository.delete(stage.id),
      'CRM_PIPELINE_STAGE_IN_USE',
    )
  })

  it('should return DATABASE_ERROR for writes on a missing stage', async () => {
    expectErr(
      await CrmPipelineStageRepository.delete('missing'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmPipelineStageRepository.update('missing', { name: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmPipelineStageRepository.create({
        pipelineId: 'missing',
        name: 'x',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmPipelineStageRepository.reorder('missing', ['missing']),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when read queries throw', async () => {
    vi.spyOn(prisma.crmPipelineStage, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmPipelineStageRepository.listByPipeline('p'),
      'DATABASE_ERROR',
    )

    vi.spyOn(prisma.crmPipelineStage, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmPipelineStageRepository.findById('s', 'p'),
      'DATABASE_ERROR',
    )
  })
})
