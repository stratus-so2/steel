import { createId } from '@paralleldrive/cuid2'
import type { CrmPipeline, CrmPipelineStage } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmPipelineDTO, CrmPipelineStageDTO } from '@/types/crm-pipeline'

export function createFakeCrmPipeline(
  overrides?: Partial<CrmPipeline>,
): CrmPipeline {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Vendas',
    position: 0,
    isDefault: false,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmPipelineDTO(
  overrides?: Partial<CrmPipelineDTO>,
): CrmPipelineDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Vendas',
    position: 0,
    isDefault: false,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmPipeline(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmPipeline, 'name' | 'isDefault' | 'position' | 'deletedAt'>
  >,
) {
  return prisma.crmPipeline.create({
    data: { name: 'Seed Pipeline', workspaceId, createdById, ...overrides },
  })
}

export function createFakeCrmPipelineStage(
  overrides?: Partial<CrmPipelineStage>,
): CrmPipelineStage {
  const now = new Date()
  return {
    id: createId(),
    pipelineId: createId(),
    name: 'Novo',
    position: 0,
    probability: 0,
    category: 'OPEN',
    color: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeCrmPipelineStageDTO(
  overrides?: Partial<CrmPipelineStageDTO>,
): CrmPipelineStageDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    pipelineId: createId(),
    name: 'Novo',
    position: 0,
    probability: 0,
    category: 'OPEN',
    color: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmPipelineStage(
  pipelineId: string,
  overrides?: Partial<
    Pick<CrmPipelineStage, 'name' | 'probability' | 'category' | 'position'>
  >,
) {
  return prisma.crmPipelineStage.create({
    data: { name: 'Seed Stage', pipelineId, ...overrides },
  })
}
