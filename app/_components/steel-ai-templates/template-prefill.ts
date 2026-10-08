import type { AiSkillInput } from '@/src/hooks/use-ai-skills'
import type { SteelAgentInput } from '@/src/hooks/use-steel-agents'
import type {
  AiSkillTemplateDTO,
  AiTemplateCategoryDTO,
  SteelAgentTemplateDTO,
} from '@/types/ai-template'
import type { AiModuleDTO } from '@/types/steel-ai'

/** pt-BR labels and order of the template categories. */
export const TEMPLATE_CATEGORIES: {
  value: AiTemplateCategoryDTO
  label: string
}[] = [
  { value: 'SERVICE_DESK', label: 'ServiceDesk' },
  { value: 'CRM', label: 'Vendas (CRM)' },
  { value: 'COMMUNICATION', label: 'Comunicação' },
  { value: 'GOVERNANCE', label: 'Governança' },
  { value: 'MANAGEMENT', label: 'Gestão' },
]

export type TemplateModuleFilter = 'ALL' | AiModuleDTO | 'PLATFORM'

/** Module filter of the gallery: platform = templates with no module. */
export function matchesModuleFilter(
  template: { modules: AiModuleDTO[] },
  filter: TemplateModuleFilter,
): boolean {
  if (filter === 'ALL') return true
  if (filter === 'PLATFORM') return template.modules.length === 0
  return template.modules.includes(filter)
}

/**
 * Editor state for a new agent from a template. The agent starts paused so
 * the admin runs "Testar agente" before it acts on a schedule.
 */
export function agentInputFromTemplate(
  template: SteelAgentTemplateDTO,
  ownerId: string,
): SteelAgentInput {
  return {
    name: template.name,
    description: template.description,
    instructions: template.instructions,
    triggerType: template.triggerType,
    cron: template.cron,
    timezone: template.timezone,
    eventKey: template.eventKey,
    enabled: false,
    ownerId,
    maxToolRounds: template.maxToolRounds,
    monthlyRunCap: null,
    tools: template.tools.map(({ toolName, mode }) => ({ toolName, mode })),
  }
}

/** "Nova skill" form values for a template (workspace scope). */
export function skillInputFromTemplate(
  template: AiSkillTemplateDTO,
): Required<Omit<AiSkillInput, 'enabled'>> {
  return {
    scope: 'WORKSPACE',
    slug: template.slug,
    name: template.name,
    description: template.description,
    instructions: template.instructions,
    mode: template.mode,
    toolNames: template.tools.map((tool) => tool.toolName),
  }
}
