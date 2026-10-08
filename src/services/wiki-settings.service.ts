import { auditMutation } from '@/lib/axiom/audit'
import type { WikiSettingsDTO } from '@/types/wiki-label'
import { ok, type Result } from '../lib/result'
import { WikiSettingsRepository } from '../repositories/wiki-settings.repository'
import type { UpdateWikiSettingsDTO } from '../schemas/wiki-label.schema'
import { assertMember, assertPrivileged } from './authz'

export const WikiSettingsService = {
  async get(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WikiSettingsDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const enabled = await WikiSettingsRepository.isEnabled(workspaceId)
    if (!enabled.ok) return enabled

    return ok({ enabled: enabled.value })
  },

  /** Workspace-wide switch, so only OWNER/ADMIN can flip it. */
  async update(
    actorId: string,
    workspaceId: string,
    dto: UpdateWikiSettingsDTO,
  ): Promise<Result<WikiSettingsDTO>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WikiSettingsRepository.setEnabled(
      workspaceId,
      dto.enabled,
    )

    auditMutation({
      entity: 'wiki_settings',
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
