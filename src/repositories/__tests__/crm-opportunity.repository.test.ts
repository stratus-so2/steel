import { afterEach, describe, expect, it, vi } from 'vitest'
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
import { prisma } from '@/src/lib/prisma'
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

  describe('reorder()', () => {
    it('should update positions across the whole workspace', async () => {
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
        await CrmOpportunityRepository.reorder(workspace.id, [b.id, a.id]),
      )

      const list = expectOk(
        await CrmOpportunityRepository.listByWorkspace(workspace.id),
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

describe('CrmOpportunityRepository — scoping and lifecycle', () => {
  it('should filter by pipelineId and ignore other workspaces', async () => {
    const { workspace, user, pipeline, stage } = await setup()
    const otherPipeline = await seedCrmPipeline(workspace.id, user.id)
    const otherStage = await seedCrmPipelineStage(otherPipeline.id)
    const matched = await seedCrmOpportunity(
      workspace.id,
      user.id,
      pipeline.id,
      stage.id,
    )
    await seedCrmOpportunity(
      workspace.id,
      user.id,
      otherPipeline.id,
      otherStage.id,
    )
    const foreign = await setup()
    await seedCrmOpportunity(
      foreign.workspace.id,
      foreign.user.id,
      foreign.pipeline.id,
      foreign.stage.id,
    )

    const list = expectOk(
      await CrmOpportunityRepository.listByWorkspace(workspace.id, {
        pipelineId: pipeline.id,
      }),
    )
    expect(list.map((o) => o.id)).toEqual([matched.id])
  })

  it('should list only live opportunities with a close date, including the stage', async () => {
    const { workspace, user, pipeline, stage } = await setup()
    const withDate = await seedCrmOpportunity(
      workspace.id,
      user.id,
      pipeline.id,
      stage.id,
    )
    await prisma.crmOpportunity.update({
      where: { id: withDate.id },
      data: { closeDate: new Date('2026-10-01') },
    })
    await seedCrmOpportunity(workspace.id, user.id, pipeline.id, stage.id)
    const deleted = await seedCrmOpportunity(
      workspace.id,
      user.id,
      pipeline.id,
      stage.id,
      { deletedAt: new Date() },
    )
    await prisma.crmOpportunity.update({
      where: { id: deleted.id },
      data: { closeDate: new Date('2026-10-01') },
    })

    const list = expectOk(
      await CrmOpportunityRepository.listOpenAndWonWithStage(workspace.id),
    )
    expect(list.map((o) => o.id)).toEqual([withDate.id])
    expect(list[0].stage).toEqual({
      probability: stage.probability,
      category: stage.category,
    })
  })

  it('should find an opportunity only inside its own workspace', async () => {
    const { workspace, user, pipeline, stage } = await setup()
    const seeded = await seedCrmOpportunity(
      workspace.id,
      user.id,
      pipeline.id,
      stage.id,
    )
    const other = await seedWorkspace()

    const found = expectOk(
      await CrmOpportunityRepository.findById(seeded.id, workspace.id),
    )
    expect(found.id).toBe(seeded.id)
    expectErr(
      await CrmOpportunityRepository.findById(seeded.id, other.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should update fields and soft delete the opportunity', async () => {
    const { workspace, user, pipeline, stage } = await setup()
    const seeded = await seedCrmOpportunity(
      workspace.id,
      user.id,
      pipeline.id,
      stage.id,
    )

    const updated = expectOk(
      await CrmOpportunityRepository.update(seeded.id, {
        name: 'Renomeado',
        amount: 1500,
        source: null,
        updatedById: user.id,
      }),
    )
    expect(updated.name).toBe('Renomeado')
    expect(Number(updated.amount)).toBe(1500)
    expect(updated.updatedById).toBe(user.id)

    expectOk(await CrmOpportunityRepository.softDelete(seeded.id))
    expectErr(
      await CrmOpportunityRepository.findById(seeded.id, workspace.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should not reorder opportunities of another stage or workspace', async () => {
    const { workspace, user, pipeline, stage } = await setup()
    const otherStage = await seedCrmPipelineStage(pipeline.id)
    const a = await seedCrmOpportunity(
      workspace.id,
      user.id,
      pipeline.id,
      otherStage.id,
    )
    const other = await seedWorkspace()

    expectErr(
      await CrmOpportunityRepository.reorderInStage(stage.id, [a.id]),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmOpportunityRepository.reorder(other.id, [a.id]),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmOpportunityLineItemRepository — lookups, updates and deletes', () => {
  async function seedOpportunity() {
    const { workspace, user, pipeline, stage } = await setup()
    return seedCrmOpportunity(workspace.id, user.id, pipeline.id, stage.id)
  }

  it('should find an item only under its own opportunity', async () => {
    const opportunity = await seedOpportunity()
    const other = await seedOpportunity()
    const item = await seedCrmOpportunityLineItem(opportunity.id)

    const found = expectOk(
      await CrmOpportunityLineItemRepository.findById(item.id, opportunity.id),
    )
    expect(found.id).toBe(item.id)
    expectErr(
      await CrmOpportunityLineItemRepository.findById(item.id, other.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should assign the next position when creating a second item', async () => {
    const opportunity = await seedOpportunity()
    await seedCrmOpportunityLineItem(opportunity.id)

    const item = expectOk(
      await CrmOpportunityLineItemRepository.create({
        opportunityId: opportunity.id,
        name: 'Suporte',
        quantity: 1,
        unitPrice: 10,
        discountPct: 0,
        billingType: 'MONTHLY',
      }),
    )
    expect(item.position).toBe(1)
    expect(Number(item.total)).toBe(10)
  })

  it('should recompute the total from new price and discount keeping the stored quantity', async () => {
    const opportunity = await seedOpportunity()
    const item = await seedCrmOpportunityLineItem(opportunity.id, {
      quantity: 2,
      unitPrice: 50,
      total: 100,
    })

    const updated = expectOk(
      await CrmOpportunityLineItemRepository.update(item.id, {
        unitPrice: 200,
        discountPct: 50,
        name: 'Novo nome',
      }),
    )
    expect(Number(updated.total)).toBe(200)
    expect(updated.name).toBe('Novo nome')
  })

  it('should keep the stored values when updating only the name', async () => {
    const opportunity = await seedOpportunity()
    const item = await seedCrmOpportunityLineItem(opportunity.id, {
      quantity: 3,
      unitPrice: 10,
      total: 30,
    })

    const updated = expectOk(
      await CrmOpportunityLineItemRepository.update(item.id, { name: 'X' }),
    )
    expect(Number(updated.total)).toBe(30)
  })

  it('should return RESOURCE_NOT_FOUND when updating a missing item', async () => {
    expectErr(
      await CrmOpportunityLineItemRepository.update('missing', {
        quantity: 2,
      }),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should delete an item and fail for a missing one', async () => {
    const opportunity = await seedOpportunity()
    const item = await seedCrmOpportunityLineItem(opportunity.id)

    expectOk(await CrmOpportunityLineItemRepository.delete(item.id))
    expect(
      expectOk(
        await CrmOpportunityLineItemRepository.listByOpportunity(
          opportunity.id,
        ),
      ),
    ).toEqual([])
    expectErr(
      await CrmOpportunityLineItemRepository.delete(item.id),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when creating an item for a missing opportunity', async () => {
    expectErr(
      await CrmOpportunityLineItemRepository.create({
        opportunityId: 'missing',
        name: 'X',
        quantity: 1,
        unitPrice: 1,
        discountPct: 0,
        billingType: 'ONE_TIME',
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmOpportunity repositories — database failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return DATABASE_ERROR when opportunity queries throw', async () => {
    vi.spyOn(prisma.crmOpportunity, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.crmOpportunity, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmOpportunity, 'count').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmOpportunity, 'update')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))

    expectErr(
      await CrmOpportunityRepository.listByWorkspace('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmOpportunityRepository.listOpenAndWonWithStage('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmOpportunityRepository.findById('o', 'w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmOpportunityRepository.create({
        workspaceId: 'w',
        createdById: 'u',
        name: 'X',
        pipelineId: 'p',
        stageId: 's',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmOpportunityRepository.update('o', { name: 'X' }),
      'DATABASE_ERROR',
    )
    expectErr(await CrmOpportunityRepository.softDelete('o'), 'DATABASE_ERROR')
  })

  it('should return DATABASE_ERROR when line item queries throw', async () => {
    vi.spyOn(prisma.crmOpportunityLineItem, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmOpportunityLineItem, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmOpportunityLineItem, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )

    expectErr(
      await CrmOpportunityLineItemRepository.listByOpportunity('o'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmOpportunityLineItemRepository.findById('i', 'o'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmOpportunityLineItemRepository.update('i', { quantity: 1 }),
      'DATABASE_ERROR',
    )
  })
})
