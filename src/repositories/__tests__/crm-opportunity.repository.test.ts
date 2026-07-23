import { describe, expect, it } from 'vitest'
import {
  seedCrmOpportunity,
  seedCrmOpportunityLineItem,
} from '@/src/__tests__/factories/crm-opportunity.factory'
import {
  seedCrmPipeline,
  seedCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmOpportunityLineItemRepository,
  CrmOpportunityRepository,
} from '../crm-opportunity.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const pipeline = await seedCrmPipeline(workspace.id, user.id)
  const stage = await seedCrmPipelineStage(pipeline.id)
  return { workspace, user, pipeline, stage }
}

describe('CrmOpportunityRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the stage', async () => {
      const { workspace, user, pipeline, stage } = await setup()
      await seedCrmOpportunity(workspace.id, user.id, pipeline.id, stage.id)

      const result = await CrmOpportunityRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Second',
        pipelineId: pipeline.id,
        stageId: stage.id,
      })

      const opportunity = expectOk(result)
      expect(opportunity.position).toBe(1)
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by stageId when provided', async () => {
      const { workspace, user, pipeline, stage } = await setup()
      const otherStage = await seedCrmPipelineStage(pipeline.id)
      const matched = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )
      await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        otherStage.id,
      )

      const list = expectOk(
        await CrmOpportunityRepository.listByWorkspace(workspace.id, {
          stageId: stage.id,
        }),
      )
      expect(list.map((o) => o.id)).toEqual([matched.id])
    })
  })

  describe('reorderInStage()', () => {
    it('should update positions within the stage', async () => {
      const { workspace, user, pipeline, stage } = await setup()
      const a = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )
      const b = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )

      expectOk(
        await CrmOpportunityRepository.reorderInStage(stage.id, [b.id, a.id]),
      )

      const list = expectOk(
        await CrmOpportunityRepository.listByWorkspace(workspace.id, {
          stageId: stage.id,
        }),
      )
      expect(list.map((o) => o.id)).toEqual([b.id, a.id])
    })
  })

  describe('findById()', () => {
    it('should return RESOURCE_NOT_FOUND for a soft-deleted opportunity', async () => {
      const { workspace, user, pipeline, stage } = await setup()
      const seeded = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
        { deletedAt: new Date() },
      )

      expectErr(
        await CrmOpportunityRepository.findById(seeded.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })
})

describe('CrmOpportunityLineItemRepository', () => {
  describe('create()', () => {
    it('should compute the total from quantity, unitPrice and discountPct', async () => {
      const { workspace, user, pipeline, stage } = await setup()
      const opportunity = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )

      const result = await CrmOpportunityLineItemRepository.create({
        opportunityId: opportunity.id,
        name: 'Licença',
        quantity: 2,
        unitPrice: 100,
        discountPct: 10,
        billingType: 'ONE_TIME',
      })

      const item = expectOk(result)
      expect(Number(item.total)).toBe(180)
    })
  })

  describe('update()', () => {
    it('should recompute the total when quantity changes', async () => {
      const { workspace, user, pipeline, stage } = await setup()
      const opportunity = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )
      const item = await seedCrmOpportunityLineItem(opportunity.id, {
        quantity: 1,
        unitPrice: 50,
        total: 50,
      })

      const result = await CrmOpportunityLineItemRepository.update(item.id, {
        quantity: 3,
      })

      const updated = expectOk(result)
      expect(Number(updated.total)).toBe(150)
    })
  })

  describe('listByOpportunity()', () => {
    it('should list items ordered by position', async () => {
      const { workspace, user, pipeline, stage } = await setup()
      const opportunity = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )
      const a = await seedCrmOpportunityLineItem(opportunity.id, {
        name: 'A',
      })
      const b = await seedCrmOpportunityLineItem(opportunity.id, {
        name: 'B',
      })

      const list = expectOk(
        await CrmOpportunityLineItemRepository.listByOpportunity(
          opportunity.id,
        ),
      )
      expect(list.map((i) => i.id)).toEqual([a.id, b.id])
    })
  })
})
