import { z } from 'zod'
import { dto } from '../common'

/** DTOs dos modelos prontos do Steel AI (`types/ai-template.d.ts`). */

const AiModule = z.enum(['SERVICE_DESK', 'CRM', 'COMMUNICATION'])
const Category = z.enum([
  'SERVICE_DESK',
  'CRM',
  'COMMUNICATION',
  'GOVERNANCE',
  'MANAGEMENT',
])

const TemplateTool = z.object({
  toolName: z.string().meta({ example: 'sd_assign_ticket' }),
  label: z.string().meta({ example: 'Atribuindo chamado' }),
  module: AiModule.nullable(),
  kind: z.enum(['READ', 'CREATE', 'UPDATE', 'DELETE', 'ACTION']),
  mode: z.enum(['AUTO', 'APPROVAL']).meta({
    description:
      'Sugestão para agentes: leitura `AUTO`, escrita `APPROVAL` (exclusão sempre `APPROVAL`).',
  }),
})

const base = {
  id: z.string().meta({ example: 'sd-sla-em-risco' }),
  name: z.string().meta({ example: 'SLA em risco' }),
  description: z.string(),
  category: Category,
  modules: z.array(AiModule).meta({
    description:
      'Módulos que precisam estar habilitados (vazio = plataforma, qualquer workspace).',
  }),
  instructions: z.string(),
  tools: z.array(TemplateTool).meta({
    description:
      'Ferramentas sugeridas; num modelo disponível, só as dos módulos habilitados.',
  }),
  available: z.boolean(),
  unavailableReason: z
    .string()
    .nullable()
    .meta({ example: 'Requer o módulo ServiceDesk habilitado.' }),
}

export const SteelAgentTemplateDTO = dto(
  'SteelAgentTemplate',
  z.object({
    ...base,
    triggerType: z.enum(['SCHEDULE', 'EVENT', 'MANUAL']),
    cron: z.string().nullable().meta({ example: '*/30 8-18 * * 1-5' }),
    scheduleLabel: z
      .string()
      .meta({ example: 'Dias úteis, a cada 30 min (8h às 18h)' }),
    timezone: z.string().meta({ example: 'America/Sao_Paulo' }),
    eventKey: z.string().nullable(),
    maxToolRounds: z.number().int(),
  }),
)

export const AiSkillTemplateDTO = dto(
  'AiSkillTemplate',
  z.object({
    ...base,
    slug: z.string().meta({ example: 'consumo-ia' }),
    mode: z.enum(['EXPLORE', 'AGENT', 'AUTOPILOT', 'TEST']).nullable(),
  }),
)

export const AiTemplatesDTO = dto(
  'AiTemplates',
  z.object({
    canUse: z.boolean().meta({
      description:
        'OWNER/ADMIN. Para os demais, `false` e listas vazias (a galeria some).',
    }),
    agentModeEnabled: z.boolean(),
    agents: z.array(SteelAgentTemplateDTO),
    skills: z.array(AiSkillTemplateDTO),
  }),
)
