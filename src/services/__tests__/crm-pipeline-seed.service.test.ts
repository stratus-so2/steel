import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmPipeline } from '@/src/__tests__/factories/crm-pipeline.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-pipeline.repository')

import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '@/src/repositories/crm-pipeline.repository'
import { CrmPipelineSeedService } from '../crm-pipeline-seed.service'

const mockedPipelineRepo = vi.mocked(CrmPipelineRepository)
const mockedStageRepo = vi.mocked(CrmPipelineStageRepository)

const WORKSPACE_ID = 'ws1'
const ACTOR_ID = 'admin1'

function stubEmptyWorkspace() {
  mockedPipelineRepo.listByWorkspace.mockResolvedValue(ok([]))
  mockedPipelineRepo.create.mockImplementation(async (data) =>
    ok(
      createFakeCrmPipeline({ workspaceId: data.workspaceId, name: data.name }),
    ),
  )
  mockedStageRepo.create.mockResolvedValue(
    ok({
      id: 's1',
      pipelineId: 'p1',
      name: 'Novo contato',
      position: 0,
      probability: 10,
      category: 'OPEN',
      color: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  )
}

describe('CrmPipelineSeedService.seedDefaultPipeline()', () => {
  it('creates a default pipeline with 6 stages when the workspace has none', async () => {
    stubEmptyWorkspace()

    const result = await CrmPipelineSeedService.seedDefaultPipeline(
      WORKSPACE_ID,
      ACTOR_ID,
    )

    expectOk(result)
    expect(mockedPipelineRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        createdById: ACTOR_ID,
        name: 'Vendas',
        isDefault: true,
      }),
    )
    expect(mockedStageRepo.create).toHaveBeenCalledTimes(6)
  })

  it('skips seeding when the workspace already has a pipeline', async () => {
    stubEmptyWorkspace()
    mockedPipelineRepo.listByWorkspace.mockResolvedValue(
      ok([createFakeCrmPipeline({ workspaceId: WORKSPACE_ID })]),
    )

    const result = await CrmPipelineSeedService.seedDefaultPipeline(
      WORKSPACE_ID,
      ACTOR_ID,
    )

    expectOk(result)
    expect(mockedPipelineRepo.create).not.toHaveBeenCalled()
    expect(mockedStageRepo.create).not.toHaveBeenCalled()
  })

  it('propagates a pipeline creation failure', async () => {
    stubEmptyWorkspace()
    mockedPipelineRepo.create.mockResolvedValueOnce(
      err(databaseError('Failed to create CRM pipeline')),
    )

    const result = await CrmPipelineSeedService.seedDefaultPipeline(
      WORKSPACE_ID,
      ACTOR_ID,
    )

    expectErr(result, 'DATABASE_ERROR')
    expect(mockedStageRepo.create).not.toHaveBeenCalled()
  })

  it('propagates a stage creation failure without creating all 6 stages', async () => {
    stubEmptyWorkspace()
    mockedStageRepo.create.mockResolvedValueOnce(
      err(databaseError('Failed to create CRM pipeline stage')),
    )

    const result = await CrmPipelineSeedService.seedDefaultPipeline(
      WORKSPACE_ID,
      ACTOR_ID,
    )

    expectErr(result, 'DATABASE_ERROR')
    expect(mockedStageRepo.create).toHaveBeenCalledTimes(1)
  })
})
