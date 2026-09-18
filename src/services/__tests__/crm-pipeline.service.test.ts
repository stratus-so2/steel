import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmPipeline,
  createFakeCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-pipeline.repository')

import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '@/src/repositories/crm-pipeline.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
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

  describe('resolveDefaultStage()', () => {
    it('should prefer the pipeline marked as default', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl-default' })),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(
        ok([
          createFakeCrmPipelineStage({
            id: 's1',
            category: 'WON',
            position: 0,
          }),
          createFakeCrmPipelineStage({
            id: 's2',
            category: 'OPEN',
            position: 1,
          }),
        ]),
      )

      const result = expectOk(
        await CrmPipelineService.resolveDefaultStage('ws1'),
      )
      expect(result).toEqual({ pipelineId: 'pl-default', stageId: 's2' })
    })

    it('should fall back to the first pipeline when none is marked default', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(ok(null))
      mockedPipelineRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmPipeline({ id: 'pl-first' })]),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(
        ok([createFakeCrmPipelineStage({ id: 's1', category: 'OPEN' })]),
      )

      const result = expectOk(
        await CrmPipelineService.resolveDefaultStage('ws1'),
      )
      expect(result).toEqual({ pipelineId: 'pl-first', stageId: 's1' })
    })

    it('should fall back to the first stage by position when none is OPEN', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl1' })),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(
        ok([
          createFakeCrmPipelineStage({
            id: 's1',
            category: 'WON',
            position: 0,
          }),
        ]),
      )

      const result = expectOk(
        await CrmPipelineService.resolveDefaultStage('ws1'),
      )
      expect(result.stageId).toBe('s1')
    })

    it('should return CRM_PIPELINE_NOT_FOUND when the workspace has no pipeline', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(ok(null))
      mockedPipelineRepo.listByWorkspace.mockResolvedValue(ok([]))

      expectErr(
        await CrmPipelineService.resolveDefaultStage('ws1'),
        'CRM_PIPELINE_NOT_FOUND',
      )
    })

    it('should return CRM_PIPELINE_NOT_FOUND when the pipeline has no stages', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl1' })),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(ok([]))

      expectErr(
        await CrmPipelineService.resolveDefaultStage('ws1'),
        'CRM_PIPELINE_NOT_FOUND',
      )
    })
  })
})

describe('CrmPipelineStageService', () => {
  describe('create()', () => {
    it('should create a stage for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
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

const dbError = () => err(databaseError('boom'))

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('CrmPipelineService — mutations', () => {
  beforeEach(() => {
    asRole('ADMIN')
    mockedPipelineRepo.findById.mockResolvedValue(
      ok(createFakeCrmPipeline({ id: 'pl1', workspaceId: 'ws1' })),
    )
  })

  describe('list()', () => {
    it('propagates repository errors', async () => {
      mockedPipelineRepo.listByWorkspace.mockResolvedValue(dbError())
      expectErr(await CrmPipelineService.list('u1', 'ws1'), 'DATABASE_ERROR')
    })

    it('returns MODULE_DISABLED when the CRM module is off', async () => {
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))
      expectErr(await CrmPipelineService.list('u1', 'ws1'), 'MODULE_DISABLED')
      expect(mockedPipelineRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('blocks members of a suspended workspace', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(
          createFakeMembership({ role: 'OWNER', workspaceStatus: 'SUSPENDED' }),
        ),
      )
      expectErr(
        await CrmPipelineService.list('u1', 'ws1'),
        'WORKSPACE_SUSPENDED',
      )
    })
  })

  describe('create()', () => {
    it('creates the pipeline and audits it', async () => {
      mockedPipelineRepo.create.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl-new', name: 'Vendas' })),
      )

      const dto = expectOk(
        await CrmPipelineService.create('u1', 'ws1', {
          name: 'Vendas',
          isDefault: true,
        }),
      )
      expect(dto.id).toBe('pl-new')
      expect(mockedPipelineRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        createdById: 'u1',
        name: 'Vendas',
        isDefault: true,
      })
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineService.create('u1', 'ws1', {
          name: 'X',
          isDefault: false,
        }),
        'FORBIDDEN',
      )
      expect(mockedPipelineRepo.create).not.toHaveBeenCalled()
    })

    it('propagates repository failures', async () => {
      mockedPipelineRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineService.create('u1', 'ws1', {
          name: 'X',
          isDefault: false,
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('updates an existing pipeline', async () => {
      mockedPipelineRepo.update.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl1', name: 'Renomeado' })),
      )

      const dto = expectOk(
        await CrmPipelineService.update('u1', 'ws1', 'pl1', {
          name: 'Renomeado',
        }),
      )
      expect(dto.name).toBe('Renomeado')
      expect(mockedPipelineRepo.update).toHaveBeenCalledWith('pl1', {
        name: 'Renomeado',
        isDefault: undefined,
        updatedById: 'u1',
      })
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineService.update('u1', 'ws1', 'pl1', { name: 'X' }),
        'FORBIDDEN',
      )
    })

    it('returns not found when the pipeline is outside the workspace', async () => {
      mockedPipelineRepo.findById.mockResolvedValue(err(notFound('Pipeline')))
      expectErr(
        await CrmPipelineService.update('u1', 'ws1', 'pl1', { name: 'X' }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedPipelineRepo.update).not.toHaveBeenCalled()
    })

    it('propagates update failures', async () => {
      mockedPipelineRepo.update.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineService.update('u1', 'ws1', 'pl1', { name: 'X' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('soft-deletes the pipeline', async () => {
      mockedPipelineRepo.softDelete.mockResolvedValue(ok(undefined))
      expectOk(await CrmPipelineService.remove('u1', 'ws1', 'pl1'))
      expect(mockedPipelineRepo.softDelete).toHaveBeenCalledWith('pl1')
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineService.remove('u1', 'ws1', 'pl1'),
        'FORBIDDEN',
      )
    })

    it('returns not found for an unknown pipeline', async () => {
      mockedPipelineRepo.findById.mockResolvedValue(err(notFound('Pipeline')))
      expectErr(
        await CrmPipelineService.remove('u1', 'ws1', 'pl1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedPipelineRepo.softDelete).not.toHaveBeenCalled()
    })

    it('propagates delete failures', async () => {
      mockedPipelineRepo.softDelete.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineService.remove('u1', 'ws1', 'pl1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('reorder()', () => {
    it('delegates the new order to the repository', async () => {
      mockedPipelineRepo.reorder.mockResolvedValue(ok(undefined))
      expectOk(await CrmPipelineService.reorder('u1', 'ws1', ['b', 'a']))
      expect(mockedPipelineRepo.reorder).toHaveBeenCalledWith('ws1', ['b', 'a'])
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineService.reorder('u1', 'ws1', ['a']),
        'FORBIDDEN',
      )
      expect(mockedPipelineRepo.reorder).not.toHaveBeenCalled()
    })
  })

  describe('resolveDefaultStage() errors', () => {
    it('propagates findDefault failures', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineService.resolveDefaultStage('ws1'),
        'DATABASE_ERROR',
      )
    })

    it('propagates listByWorkspace failures on fallback', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(ok(null))
      mockedPipelineRepo.listByWorkspace.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineService.resolveDefaultStage('ws1'),
        'DATABASE_ERROR',
      )
    })

    it('propagates stage listing failures', async () => {
      mockedPipelineRepo.findDefault.mockResolvedValue(
        ok(createFakeCrmPipeline({ id: 'pl1' })),
      )
      mockedStageRepo.listByPipeline.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineService.resolveDefaultStage('ws1'),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('CrmPipelineStageService — full CRUD', () => {
  beforeEach(() => {
    asRole('ADMIN')
    mockedPipelineRepo.findById.mockResolvedValue(
      ok(createFakeCrmPipeline({ id: 'pl1', workspaceId: 'ws1' })),
    )
    mockedStageRepo.findById.mockResolvedValue(
      ok(createFakeCrmPipelineStage({ id: 'st1', pipelineId: 'pl1' })),
    )
  })

  const pipelineMissing = () =>
    mockedPipelineRepo.findById.mockResolvedValue(err(notFound('Pipeline')))
  const stageMissing = () =>
    mockedStageRepo.findById.mockResolvedValue(err(notFound('Stage')))

  describe('list()', () => {
    it('lists the stages of a pipeline', async () => {
      mockedStageRepo.listByPipeline.mockResolvedValue(
        ok([
          createFakeCrmPipelineStage({ id: 'a' }),
          createFakeCrmPipelineStage({ id: 'b' }),
        ]),
      )
      const dtos = expectOk(
        await CrmPipelineStageService.list('u1', 'ws1', 'pl1'),
      )
      expect(dtos.map((d) => d.id)).toEqual(['a', 'b'])
    })

    it('returns FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmPipelineStageService.list('u1', 'ws1', 'pl1'),
        'FORBIDDEN',
      )
    })

    it('returns not found when the pipeline is not in the workspace', async () => {
      pipelineMissing()
      expectErr(
        await CrmPipelineStageService.list('u1', 'ws1', 'pl1'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('propagates listing failures', async () => {
      mockedStageRepo.listByPipeline.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineStageService.list('u1', 'ws1', 'pl1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    const input = { name: 'Novo', probability: 10, category: 'OPEN' as const }

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineStageService.create('u1', 'ws1', 'pl1', input),
        'FORBIDDEN',
      )
    })

    it('returns not found for a foreign pipeline', async () => {
      pipelineMissing()
      expectErr(
        await CrmPipelineStageService.create('u1', 'ws1', 'pl1', input),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedStageRepo.create).not.toHaveBeenCalled()
    })

    it('propagates creation failures', async () => {
      mockedStageRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineStageService.create('u1', 'ws1', 'pl1', input),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('updates the stage', async () => {
      mockedStageRepo.update.mockResolvedValue(
        ok(createFakeCrmPipelineStage({ id: 'st1', name: 'Proposta' })),
      )
      const dto = expectOk(
        await CrmPipelineStageService.update('u1', 'ws1', 'pl1', 'st1', {
          name: 'Proposta',
        }),
      )
      expect(dto.name).toBe('Proposta')
      expect(mockedStageRepo.update).toHaveBeenCalledWith('st1', {
        name: 'Proposta',
      })
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineStageService.update('u1', 'ws1', 'pl1', 'st1', {}),
        'FORBIDDEN',
      )
    })

    it('returns not found for a foreign pipeline', async () => {
      pipelineMissing()
      expectErr(
        await CrmPipelineStageService.update('u1', 'ws1', 'pl1', 'st1', {}),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('returns not found for a stage of another pipeline', async () => {
      stageMissing()
      expectErr(
        await CrmPipelineStageService.update('u1', 'ws1', 'pl1', 'st1', {}),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedStageRepo.update).not.toHaveBeenCalled()
    })

    it('propagates update failures', async () => {
      mockedStageRepo.update.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineStageService.update('u1', 'ws1', 'pl1', 'st1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('deletes the stage', async () => {
      mockedStageRepo.delete.mockResolvedValue(ok(undefined))
      expectOk(await CrmPipelineStageService.remove('u1', 'ws1', 'pl1', 'st1'))
      expect(mockedStageRepo.delete).toHaveBeenCalledWith('st1')
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineStageService.remove('u1', 'ws1', 'pl1', 'st1'),
        'FORBIDDEN',
      )
    })

    it('returns not found for a foreign pipeline', async () => {
      pipelineMissing()
      expectErr(
        await CrmPipelineStageService.remove('u1', 'ws1', 'pl1', 'st1'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('returns not found for an unknown stage', async () => {
      stageMissing()
      expectErr(
        await CrmPipelineStageService.remove('u1', 'ws1', 'pl1', 'st1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedStageRepo.delete).not.toHaveBeenCalled()
    })

    it('propagates delete failures', async () => {
      mockedStageRepo.delete.mockResolvedValue(dbError())
      expectErr(
        await CrmPipelineStageService.remove('u1', 'ws1', 'pl1', 'st1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('reorder()', () => {
    it('reorders the stages of the pipeline', async () => {
      mockedStageRepo.reorder.mockResolvedValue(ok(undefined))
      expectOk(
        await CrmPipelineStageService.reorder('u1', 'ws1', 'pl1', ['b', 'a']),
      )
      expect(mockedStageRepo.reorder).toHaveBeenCalledWith('pl1', ['b', 'a'])
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmPipelineStageService.reorder('u1', 'ws1', 'pl1', []),
        'FORBIDDEN',
      )
    })

    it('returns not found for a foreign pipeline', async () => {
      pipelineMissing()
      expectErr(
        await CrmPipelineStageService.reorder('u1', 'ws1', 'pl1', []),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedStageRepo.reorder).not.toHaveBeenCalled()
    })
  })
})
