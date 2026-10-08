import type { AiSkill } from '@prisma/client'
import {
  type BuiltInSkill,
  builtInSkillId,
} from '@/src/lib/ai/context/builtin-skills'
import type { AiSkillDTO } from '@/types/ai-skill'

/** Custom (workspace or personal) skill. */
export function toAiSkillDTO(
  row: AiSkill,
  permissions: { canManageWorkspace: boolean; actorId: string },
): AiSkillDTO {
  const mine =
    row.scope === 'PERSONAL'
      ? row.ownerId === permissions.actorId
      : permissions.canManageWorkspace
  return {
    id: row.id,
    kind: row.scope,
    slug: row.slug,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    mode: row.mode,
    toolNames: row.toolNames,
    enabled: row.enabled,
    canEdit: mine,
    canToggle: mine,
    canDelete: mine,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Built-in skill: text from code, `enabled` from the workspace override row
 * (no row = enabled). Only admins may toggle; nobody edits or deletes.
 */
export function toBuiltInAiSkillDTO(
  skill: BuiltInSkill,
  override: AiSkill | null,
  canManageWorkspace: boolean,
): AiSkillDTO {
  return {
    id: builtInSkillId(skill.slug),
    kind: 'BUILT_IN',
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    instructions: skill.instructions,
    mode: skill.mode,
    toolNames: [...skill.toolNames],
    enabled: override?.enabled ?? true,
    canEdit: false,
    canToggle: canManageWorkspace,
    canDelete: false,
    updatedAt: override ? override.updatedAt.toISOString() : null,
  }
}
