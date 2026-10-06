import { ok, type Result } from '@/src/lib/result'
import { toAiActionLogDTO } from '@/src/mappers/ai-action-log.mapper'
import { AiActionLogRepository } from '@/src/repositories/ai-action-log.repository'
import type { AiActionLogDTO } from '@/types/steel-ai'
import { assertMember } from './authz'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

/**
 * "What did the AI change" — the AiActionLog trail. Same gate as the audit
 * log screen (`audit-logs` × VIEW; OWNER/ADMIN always pass).
 */
export const AiActionLogService = {
  async list(
    actorId: string,
    workspaceId: string,
    filter: { targetType?: string; targetId?: string; limit?: number } = {},
  ): Promise<Result<AiActionLogDTO[]>> {
    const membership = await assertMember(actorId, workspaceId, {
      resource: 'audit-logs',
      action: 'VIEW',
    })
    if (!membership.ok) return membership

    const limit = Math.min(
      Math.max(filter.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )
    const logs = await AiActionLogRepository.listByWorkspace(workspaceId, {
      targetType: filter.targetType,
      targetId: filter.targetId,
      limit,
    })
    if (!logs.ok) return logs
    return ok(logs.value.map(toAiActionLogDTO))
  },
}
