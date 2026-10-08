import type { AiConversationModeDTO } from './steel-ai'

/** Where a skill comes from: shipped with Steel, shared, or the user's own. */
export type AiSkillKindDTO = 'BUILT_IN' | 'WORKSPACE' | 'PERSONAL'

/** A Steel AI skill: reusable instructions invoked with "/<slug>". */
export interface AiSkillDTO {
  /** Database id, or `builtin:<slug>` for a built-in skill. */
  id: string
  kind: AiSkillKindDTO
  /** Command without the slash, e.g. "my-work". */
  slug: string
  name: string
  description: string
  instructions: string
  /** Suggested mode when invoked (null = keep the conversation mode). */
  mode: AiConversationModeDTO | null
  /** Tools the skill suggests (a hint for the model; empty = any). */
  toolNames: string[]
  enabled: boolean
  /** Name, command, text, mode and tools may be changed. */
  canEdit: boolean
  /** May be switched on/off. */
  canToggle: boolean
  canDelete: boolean
  /** Null for a built-in that was never toggled. */
  updatedAt: string | null
}

/** `GET .../ai/skills`. */
export interface AiSkillListDTO {
  skills: AiSkillDTO[]
  /** OWNER/ADMIN: may create workspace skills and toggle built-ins. */
  canManageWorkspace: boolean
}
