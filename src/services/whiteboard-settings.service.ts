import { auditMutation } from '@/lib/axiom/audit'
import type { WhiteboardSettingsDTO } from '@/types/whiteboard'
import { ok, type Result } from '../lib/result'
import { WhiteboardSettingsRepository } from '../repositories/whiteboard.repository'
import type { UpdateWhiteboardSettingsDTO } from '../schemas/whiteboard.schema'
import { assertMember, assertPrivileged } from './authz'

export const WhiteboardSettingsService = {
  async get(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhiteboardSettingsDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const enabled = await WhiteboardSettingsRepository.isEnabled(workspaceId)
    if (!enabled.ok) return enabled

    return ok({ enabled: enabled.value })
  },

  /** Workspace-wide switch, so only OWNER/ADMIN can flip it. */
  async update(
    actorId: string,
    workspaceId: string,
    dto: UpdateWhiteboardSettingsDTO,
  ): Promise<Result<WhiteboardSettingsDTO>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhiteboardSettingsRepository.setEnabled(
      workspaceId,
      dto.enabled,
    )

    auditMutation({
      entity: 'whiteboard_settings',
      action: 'update',
      actorId,
      targetId: workspaceId,
      ...(result.ok
        ? {}
        : { outcome: 'failure' as const, reason: result.error.code }),
      meta: { enabled: dto.enabled },
    })
    if (!result.ok) return result

    return ok({ enabled: result.value })
  },
}
