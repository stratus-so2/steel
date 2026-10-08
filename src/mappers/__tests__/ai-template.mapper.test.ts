import { describe, expect, it } from 'vitest'
import type {
  AiSkillTemplate,
  SteelAgentTemplate,
} from '@/src/lib/ai/templates/types'
import {
  type AiTemplateToolInfo,
  templateUnavailableReason,
  toAiSkillTemplateDTO,
  toSteelAgentTemplateDTO,
} from '../ai-template.mapper'

const TOOLS: Record<string, AiTemplateToolInfo> = {
  ws_overview: { label: 'Workspace', module: null, kind: 'READ' },
  sd_read: { label: 'Ler chamados', module: 'SERVICE_DESK', kind: 'READ' },
  sd_write: { label: 'Atribuir', module: 'SERVICE_DESK', kind: 'UPDATE' },
  sd_delete: { label: 'Excluir', module: 'SERVICE_DESK', kind: 'DELETE' },
  crm_read: { label: 'Ler leads', module: 'CRM', kind: 'READ' },
}
const lookup = (name: string) => TOOLS[name]

const agent = (
  overrides?: Partial<SteelAgentTemplate>,
): SteelAgentTemplate => ({
  id: 'sd-agent',
  name: 'Agente',
  description: 'Descrição',
  category: 'SERVICE_DESK',
  modules: ['SERVICE_DESK'],
  instructions: 'Faça algo',
  triggerType: 'SCHEDULE',
  cron: '0 8 * * 1-5',
  scheduleLabel: 'Dias úteis às 8h',
  timezone: 'America/Sao_Paulo',
  maxToolRounds: 6,
  tools: [
    { toolName: 'sd_read', mode: 'APPROVAL' },
    { toolName: 'sd_write', mode: 'AUTO' },
    { toolName: 'sd_delete', mode: 'AUTO' },
    { toolName: 'ws_overview', mode: 'AUTO' },
    { toolName: 'gone', mode: 'AUTO' },
  ],
  ...overrides,
})

const skill = (overrides?: Partial<AiSkillTemplate>): AiSkillTemplate => ({
  id: 'skill',
  slug: 'skill',
  name: 'Skill',
  description: 'Descrição',
  category: 'GOVERNANCE',
  modules: [],
  instructions: 'Faça algo',
  mode: 'EXPLORE',
  toolNames: ['ws_overview', 'sd_read', 'crm_read'],
  ...overrides,
})

describe('templateUnavailableReason', () => {
  it('should be null when nothing is missing', () => {
    expect(templateUnavailableReason([])).toBeNull()
  })

  it('should name one or several missing modules in pt-BR', () => {
    expect(templateUnavailableReason(['SERVICE_DESK'])).toBe(
      'Requer o módulo ServiceDesk habilitado.',
    )
    expect(templateUnavailableReason(['CRM', 'COMMUNICATION'])).toBe(
      'Requer os módulos CRM e Comunicação habilitados.',
    )
    expect(
      templateUnavailableReason(['SERVICE_DESK', 'CRM', 'COMMUNICATION']),
    ).toBe('Requer os módulos ServiceDesk, CRM e Comunicação habilitados.')
  })
})

describe('toSteelAgentTemplateDTO', () => {
  it('should map an available template with the effective tool modes', () => {
    const dto = toSteelAgentTemplateDTO(agent(), ['SERVICE_DESK'], lookup)
    expect(dto).toMatchObject({
      id: 'sd-agent',
      available: true,
      unavailableReason: null,
      modules: ['SERVICE_DESK'],
      triggerType: 'SCHEDULE',
      cron: '0 8 * * 1-5',
      scheduleLabel: 'Dias úteis às 8h',
      timezone: 'America/Sao_Paulo',
      eventKey: null,
      maxToolRounds: 6,
    })
    expect(dto.tools).toEqual([
      {
        toolName: 'sd_read',
        label: 'Ler chamados',
        module: 'SERVICE_DESK',
        kind: 'READ',
        mode: 'AUTO',
      },
      {
        toolName: 'sd_write',
        label: 'Atribuir',
        module: 'SERVICE_DESK',
        kind: 'UPDATE',
        mode: 'AUTO',
      },
      {
        toolName: 'sd_delete',
        label: 'Excluir',
        module: 'SERVICE_DESK',
        kind: 'DELETE',
        mode: 'APPROVAL',
      },
      {
        toolName: 'ws_overview',
        label: 'Workspace',
        module: null,
        kind: 'READ',
        mode: 'AUTO',
      },
    ])
  })

  it('should keep every known tool when a required module is disabled', () => {
    const dto = toSteelAgentTemplateDTO(agent(), ['CRM'], lookup)
    expect(dto.available).toBe(false)
    expect(dto.unavailableReason).toBe(
      'Requer o módulo ServiceDesk habilitado.',
    )
    expect(dto.tools.map((t) => t.toolName)).toEqual([
      'sd_read',
      'sd_write',
      'sd_delete',
      'ws_overview',
    ])
  })

  it('should not share the modules array with the catalog', () => {
    const template = agent()
    const dto = toSteelAgentTemplateDTO(template, ['SERVICE_DESK'], lookup)
    expect(dto.modules).not.toBe(template.modules)
  })
})

describe('toAiSkillTemplateDTO', () => {
  it('should drop tools of disabled modules from a platform template', () => {
    const dto = toAiSkillTemplateDTO(skill(), ['CRM'], lookup)
    expect(dto).toMatchObject({
      id: 'skill',
      slug: 'skill',
      mode: 'EXPLORE',
      available: true,
      unavailableReason: null,
      category: 'GOVERNANCE',
    })
    expect(dto.tools.map((t) => t.toolName)).toEqual([
      'ws_overview',
      'crm_read',
    ])
  })

  it('should flag a skill whose module is disabled', () => {
    const dto = toAiSkillTemplateDTO(
      skill({ modules: ['CRM'], toolNames: ['crm_read'] }),
      [],
      lookup,
    )
    expect(dto.available).toBe(false)
    expect(dto.unavailableReason).toBe('Requer o módulo CRM habilitado.')
    expect(dto.tools.map((t) => t.toolName)).toEqual(['crm_read'])
  })
})
