import type { CrmStageCategory } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  CrmPipelineRepository,
  CrmPipelineStageRepository,
} from '@/src/repositories/crm-pipeline.repository'

/**
 * Pipeline padrão criado quando o módulo CRM é liberado pra um workspace —
 * sem isso, a primeira tentativa de criar uma oportunidade falha com
 * "pipeline não encontrado" porque não existe nenhum pipeline/etapa ainda.
 * Idempotente: só roda se o workspace ainda não tiver nenhum pipeline.
 */

const DEFAULT_PIPELINE_NAME = 'Vendas'

const DEFAULT_STAGES: {
  name: string
  probability: number
  category: CrmStageCategory
}[] = [
  { name: 'Novo contato', probability: 10, category: 'OPEN' },
  { name: 'Qualificação', probability: 25, category: 'OPEN' },
  { name: 'Proposta', probability: 50, category: 'OPEN' },
  { name: 'Negociação', probability: 75, category: 'OPEN' },
  { name: 'Ganho', probability: 100, category: 'WON' },
  { name: 'Perdido', probability: 0, category: 'LOST' },
]

export const CrmPipelineSeedService = {
  async seedDefaultPipeline(
    workspaceId: string,
    actorId: string,
  ): Promise<Result<void>> {
    const existing = await CrmPipelineRepository.listByWorkspace(workspaceId)
    if (!existing.ok) return existing
    if (existing.value.length > 0) return ok(undefined)

    const pipeline = await CrmPipelineRepository.create({
      workspaceId,
      createdById: actorId,
      name: DEFAULT_PIPELINE_NAME,
      isDefault: true,
    })
    if (!pipeline.ok) return pipeline

    for (const stage of DEFAULT_STAGES) {
      const created = await CrmPipelineStageRepository.create({
        pipelineId: pipeline.value.id,
        name: stage.name,
        probability: stage.probability,
        category: stage.category,
      })
      if (!created.ok) return created
    }

    auditMutation({
      entity: 'crm_pipeline',
      action: 'create',
      actorId,
      targetId: pipeline.value.id,
      meta: { seeded: true, name: DEFAULT_PIPELINE_NAME },
    })

    return ok(undefined)
  },
}
