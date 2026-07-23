import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmOpportunity,
  createFakeCrmOpportunityLineItem,
} from '@/src/__tests__/factories/crm-opportunity.factory'
import {
  createFakeCrmPipeline,
  createFakeCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-opportunity.repository')
vi.mock('@/src/repositories/crm-pipeline.repository')
vi.mock('@/src/repositories/crm-activity.repository')
vi.mock('@/src/repositories/crm-custom-field.repository')

import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import { CrmCustomFieldValueRepository } from '@/src/repositories/crm-custom-field.repository'
import {
  CrmOpportunityLineItemRepository,
  CrmOpportunityRepository,
} from '@/src/repositories/crm-opportunity.repository'
import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '@/src/repositories/crm-pipeline.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  CrmOpportunityLineItemService,
  CrmOpportunityService,
} from '../crm-opportunity.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedOpportunityRepo = vi.mocked(CrmOpportunityRepository)
const mockedLineItemRepo = vi.mocked(CrmOpportunityLineItemRepository)
const mockedCustomFieldValueRepo = vi.mocked(CrmCustomFieldValueRepository)

mockedCustomFieldValueRepo.listByRecords.mockResolvedValue(ok([]))
const mockedPipelineRepo = vi.mocked(CrmPipelineRepository)
const mockedStageRepo = vi.mocked(CrmPipelineStageRepository)
const mockedActivityRepo = vi.mocked(CrmActivityRepository)

describe('CrmOpportunityService', () => {
  describe('list()', () => {
    it('should return opportunities for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedOpportunityRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmOpportunity({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmOpportunityService.list('u1', 'ws1', {}))
      expect(dtos).toHaveLength(1)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await CrmOpportunityService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    beforeEach(() => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
    })

    it('should resolve the workspace default pipeline/stage when both are omitted', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl-default' })),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(
        ok([createFakeCrmPipelineStage({ id: 's1', category: 'OPEN' })]),
      )
      mockedOpportunityRepo.create.mockResolvedValue(
        ok(
          createFakeCrmOpportunity({
            pipelineId: 'pl-default',
            stageId: 's1',
          }),
        ),
      )

      expectOk(
        await CrmOpportunityService.create('u1', 'ws1', { name: 'Negócio' }),
      )
      expect(mockedOpportunityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pipelineId: 'pl-default', stageId: 's1' }),
      )
      expect(mockedActivityRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'opportunity', action: 'CREATED' }),
      )
    })

    it('should resolve the first stage when only pipelineId is given', async () => {
      mockedPipelineRepo.findById.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl1' })),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(
        ok([createFakeCrmPipelineStage({ id: 's1', category: 'OPEN' })]),
      )
      mockedOpportunityRepo.create.mockResolvedValue(
        ok(createFakeCrmOpportunity({ pipelineId: 'pl1', stageId: 's1' })),
      )

      expectOk(
        await CrmOpportunityService.create('u1', 'ws1', {
          name: 'Negócio',
          pipelineId: 'pl1',
        }),
      )
      expect(mockedOpportunityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pipelineId: 'pl1', stageId: 's1' }),
      )
    })

    it('should validate stageId belongs to pipelineId when both are given', async () => {
      mockedPipelineRepo.findById.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl1' })),
      )
      mockedStageRepo.findById.mockResolvedValue(
        ok(createFakeCrmPipelineStage({ id: 's2' })),
      )
      mockedOpportunityRepo.create.mockResolvedValue(
        ok(createFakeCrmOpportunity({ pipelineId: 'pl1', stageId: 's2' })),
      )

      expectOk(
        await CrmOpportunityService.create('u1', 'ws1', {
          name: 'Negócio',
          pipelineId: 'pl1',
          stageId: 's2',
        }),
      )
      expect(mockedOpportunityRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ pipelineId: 'pl1', stageId: 's2' }),
      )
    })

    it('should return BAD_REQUEST when stageId is given without pipelineId', async () => {
      expectErr(
        await CrmOpportunityService.create('u1', 'ws1', {
          name: 'Negócio',
          stageId: 's1',
        }),
        'BAD_REQUEST',
      )
      expect(mockedOpportunityRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('update()', () => {
    beforeEach(() => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
    })

    it('should keep the current pipeline/stage when neither is given', async () => {
      mockedOpportunityRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmOpportunity({
            id: 'op1',
            pipelineId: 'pl1',
            stageId: 's1',
          }),
        ),
      )
      mockedOpportunityRepo.update.mockResolvedValue(
        ok(
          createFakeCrmOpportunity({
            id: 'op1',
            pipelineId: 'pl1',
            stageId: 's1',
          }),
        ),
      )

      expectOk(
        await CrmOpportunityService.update('u1', 'ws1', 'op1', {
          name: 'Renomeado',
        }),
      )
      expect(mockedOpportunityRepo.update).toHaveBeenCalledWith(
        'op1',
        expect.objectContaining({
          pipelineId: undefined,
          stageId: undefined,
        }),
      )
    })

    it('should resolve the first stage of the new pipeline when only pipelineId changes', async () => {
      mockedOpportunityRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmOpportunity({
            id: 'op1',
            pipelineId: 'pl1',
            stageId: 's1',
          }),
        ),
      )
      mockedPipelineRepo.findById.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl2' })),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(
        ok([createFakeCrmPipelineStage({ id: 's9', category: 'OPEN' })]),
      )
      mockedOpportunityRepo.update.mockResolvedValue(
        ok(
          createFakeCrmOpportunity({
            id: 'op1',
            pipelineId: 'pl2',
            stageId: 's9',
          }),
        ),
      )

      expectOk(
        await CrmOpportunityService.update('u1', 'ws1', 'op1', {
          pipelineId: 'pl2',
        }),
      )
      expect(mockedOpportunityRepo.update).toHaveBeenCalledWith(
        'op1',
        expect.objectContaining({ pipelineId: 'pl2', stageId: 's9' }),
      )
    })
  })
})

describe('CrmOpportunityLineItemService', () => {
  describe('create()', () => {
    it('should create a line item when the opportunity exists', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedOpportunityRepo.findById.mockResolvedValue(
        ok(createFakeCrmOpportunity({ id: 'op1' })),
      )
      mockedLineItemRepo.create.mockResolvedValue(
        ok(createFakeCrmOpportunityLineItem({ name: 'Licença' })),
      )

      const dto = expectOk(
        await CrmOpportunityLineItemService.create('u1', 'ws1', 'op1', {
          name: 'Licença',
          quantity: 1,
          unitPrice: 0,
          discountPct: 0,
          billingType: 'ONE_TIME',
        }),
      )
      expect(dto.name).toBe('Licença')
    })
  })
})
