import { describe, expect, it } from 'vitest'
import {
  seedCrmPipeline,
  seedCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
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
