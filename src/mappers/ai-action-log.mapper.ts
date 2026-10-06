import type { AiActionLog } from '@prisma/client'
import type { AiActionLogDTO } from '@/types/steel-ai'

export function toAiActionLogDTO(row: AiActionLog): AiActionLogDTO {
  return {
    id: row.id,
    source: row.source,
    actorId: row.actorId,
    agentId: row.agentId,
    pendingActionId: row.pendingActionId,
    toolName: row.toolName,
    kind: row.kind,
    module: row.module,
    targetType: row.targetType,
    targetId: row.targetId,
    outcome: row.outcome,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  }
}
