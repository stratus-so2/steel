import type { AiMemory } from '@prisma/client'
import type { AiMemoryDTO, AiMemoryRefDTO } from '@/types/ai-memory'

export function toAiMemoryDTO(
  row: AiMemory,
  viewer: { actorId: string; canManageWorkspace: boolean },
): AiMemoryDTO {
  return {
    id: row.id,
    scope: row.scope,
    content: row.content,
    source: row.source,
    // Conversations are private: only who saved the fact gets the link.
    sourceConversationId:
      row.createdById === viewer.actorId ? row.sourceConversationId : null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    canEdit:
      row.scope === 'WORKSPACE'
        ? viewer.canManageWorkspace
        : row.userId === viewer.actorId,
  }
}

export function toAiMemoryRefDTO(
  row: AiMemory,
  action: AiMemoryRefDTO['action'],
): AiMemoryRefDTO {
  return { id: row.id, scope: row.scope, content: row.content, action }
}
