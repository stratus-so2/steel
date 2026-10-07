import type { AiPendingAction } from '@prisma/client'
import type { AiPendingActionDTO, AiToolPreviewDTO } from '@/types/steel-ai'

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null
}

/** `result` JSON written on execution: `{ summary, target?, data? }`. */
function resultSummary(result: unknown): string | null {
  if (result && typeof result === 'object' && 'summary' in result) {
    const summary = (result as { summary: unknown }).summary
    return typeof summary === 'string' ? summary : null
  }
  return null
}

export function toAiPendingActionDTO(row: AiPendingAction): AiPendingActionDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    agentRunId: row.agentRunId,
    toolName: row.toolName,
    kind: row.kind,
    module: row.module,
    preview: row.preview as unknown as AiToolPreviewDTO,
    status: row.status,
    requiresDoubleConfirm: row.requiresDoubleConfirm,
    autoExecuted: row.autoExecuted,
    resultSummary: resultSummary(row.result),
    error: row.error,
    expiresAt: row.expiresAt.toISOString(),
    decidedAt: iso(row.decidedAt),
    executedAt: iso(row.executedAt),
    createdAt: row.createdAt.toISOString(),
  }
}
