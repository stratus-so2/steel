import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmPipeline,
  createFakeCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-pipeline.repository')

import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '@/src/repositories/crm-pipeline.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  CrmPipelineService,
  CrmPipelineStageService,
} from '../crm-pipeline.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedPipelineRepo = vi.mocked(CrmPipelineRepository)
const mockedStageRepo = vi.mocked(CrmPipelineStageRepository)

describe('CrmPipelineService', () => {
  describe('list()', () => {
    it('should return pipelines for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedPipelineRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmPipeline({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmPipelineService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await CrmPipelineService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })
})

describe('CrmPipelineStageService', () => {
  describe('create()', () => {
    it('should create a stage for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedPipelineRepo.findById.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl1' })),
      )
      mockedStageRepo.create.mockResolvedValue(
        ok(createFakeCrmPipelineStage({ name: 'Novo' })),
      )

      const dto = expectOk(
        await CrmPipelineStageService.create('u1', 'ws1', 'pl1', {
          name: 'Novo',
          probability: 0,
          category: 'OPEN',
        }),
      )
      expect(dto.name).toBe('Novo')
    })
  })
})
