import type { SteelAgentToolModeDTO, SteelAgentTriggerTypeDTO } from './steel-agent'
import type {
  AiActionKindDTO,
  AiConversationModeDTO,
  AiModuleDTO,
} from './steel-ai'

/**
 * Ready-made Steel AI templates for workspace admins
 * (`GET /api/workspaces/:id/ai/templates`). Templates live in code; using
 * one only pre-fills the agent editor or the skill form — saving goes
 * through the normal create endpoints.
 */

export type AiTemplateCategoryDTO =
  | 'SERVICE_DESK'
  | 'CRM'
  | 'COMMUNICATION'
  | 'GOVERNANCE'
  | 'MANAGEMENT'

/** A tool suggested by a template (only tools of enabled modules). */
export interface AiTemplateToolDTO {
  toolName: string
  /** pt-BR label of the tool. */
  label: string
  module: AiModuleDTO | null
  kind: 'READ' | AiActionKindDTO
  /** Suggested mode for agents: reads AUTO, writes APPROVAL. */
  mode: SteelAgentToolModeDTO
}

interface AiTemplateBaseDTO {
  id: string
  name: string
  description: string
  category: AiTemplateCategoryDTO
  /** Modules that must be enabled for the template to be usable. */
  modules: AiModuleDTO[]
  instructions: string
  tools: AiTemplateToolDTO[]
  available: boolean
  /** pt-BR reason when `available` is false. */
  unavailableReason: string | null
}

export interface SteelAgentTemplateDTO extends AiTemplateBaseDTO {
  triggerType: SteelAgentTriggerTypeDTO
  cron: string | null
  /** pt-BR description of the schedule ("Dias úteis às 9h"). */
  scheduleLabel: string
  timezone: string
  eventKey: string | null
  maxToolRounds: number
}

export interface AiSkillTemplateDTO extends AiTemplateBaseDTO {
  /** Suggested command (without the slash). */
  slug: string
  mode: AiConversationModeDTO | null
}

export interface AiTemplatesDTO {
  /** OWNER/ADMIN only; everyone else gets empty lists. */
  canUse: boolean
  agentModeEnabled: boolean
  agents: SteelAgentTemplateDTO[]
  skills: AiSkillTemplateDTO[]
}
