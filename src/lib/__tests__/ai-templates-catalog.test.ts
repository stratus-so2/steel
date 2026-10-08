import { ModuleKind } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { BUILT_IN_SKILLS } from '@/src/lib/ai/context/builtin-skills'
import {
  findSteelAgentTemplate,
  STEEL_AGENT_TEMPLATES,
} from '@/src/lib/ai/templates/agent-templates'
import {
  AI_SKILL_TEMPLATES,
  findAiSkillTemplate,
} from '@/src/lib/ai/templates/skill-templates'
import { STEEL_AI_TOOLS } from '@/src/lib/ai/tools'
import { isValidCron, isValidTimeZone } from '@/src/lib/steel-agents/schedule'
import { CreateAiSkillSchema } from '@/src/schemas/ai-skill.schema'
import { CreateSteelAgentSchema } from '@/src/schemas/steel-agent.schema'

const MODULES = Object.values(ModuleKind) as string[]
const toolByName = new Map(STEEL_AI_TOOLS.map((tool) => [tool.name, tool]))
const ALL = [...STEEL_AGENT_TEMPLATES, ...AI_SKILL_TEMPLATES]

describe('AI templates catalog', () => {
  it('should offer 8–10 agent templates and 6–8 skill templates', () => {
    expect(STEEL_AGENT_TEMPLATES.length).toBeGreaterThanOrEqual(8)
    expect(STEEL_AGENT_TEMPLATES.length).toBeLessThanOrEqual(10)
    expect(AI_SKILL_TEMPLATES.length).toBeGreaterThanOrEqual(6)
    expect(AI_SKILL_TEMPLATES.length).toBeLessThanOrEqual(8)
  })

  it('should have unique kebab-case ids per kind', () => {
    for (const list of [STEEL_AGENT_TEMPLATES, AI_SKILL_TEMPLATES]) {
      const ids = list.map((t) => t.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })

  it('should only require real ModuleKind values', () => {
    for (const template of ALL) {
      for (const module of template.modules) expect(MODULES).toContain(module)
      expect(new Set(template.modules).size).toBe(template.modules.length)
    }
  })

  it('should cover every module and the platform', () => {
    const covered = new Set(STEEL_AGENT_TEMPLATES.flatMap((t) => t.modules))
    expect([...covered].sort()).toEqual([...MODULES].sort())
    expect(STEEL_AGENT_TEMPLATES.some((t) => t.modules.length === 0)).toBe(true)
  })

  it('should find templates by id', () => {
    expect(findSteelAgentTemplate('sd-sla-em-risco')?.name).toBe('SLA em risco')
    expect(findSteelAgentTemplate('nope')).toBeUndefined()
    expect(findAiSkillTemplate('membros')?.slug).toBe('membros')
    expect(findAiSkillTemplate('nope')).toBeUndefined()
  })
})

describe('agent templates', () => {
  it.each(STEEL_AGENT_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s should only use registry tools of its modules or the platform',
    (_id, template) => {
      expect(template.tools.length).toBeGreaterThan(0)
      const names = template.tools.map((t) => t.toolName)
      expect(new Set(names).size).toBe(names.length)
      for (const spec of template.tools) {
        const tool = toolByName.get(spec.toolName)
        expect(tool, spec.toolName).toBeDefined()
        if (tool?.module && template.modules.length > 0) {
          expect(template.modules).toContain(tool.module)
        }
      }
    },
  )

  it.each(STEEL_AGENT_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s should never write on its own',
    (_id, template) => {
      for (const spec of template.tools) {
        const kind = toolByName.get(spec.toolName)?.kind
        if (kind === 'READ') expect(spec.mode).toBe('AUTO')
        else expect(spec.mode, spec.toolName).toBe('APPROVAL')
      }
    },
  )

  it.each(STEEL_AGENT_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s should have a valid schedule',
    (_id, template) => {
      expect(isValidTimeZone(template.timezone)).toBe(true)
      expect(template.scheduleLabel.length).toBeGreaterThan(0)
      if (template.triggerType === 'SCHEDULE') {
        expect(template.cron).not.toBeNull()
        expect(isValidCron(template.cron ?? '', template.timezone)).toBe(true)
      } else {
        expect(template.cron).toBeNull()
      }
    },
  )

  it.each(STEEL_AGENT_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s should pass the create schema',
    (_id, template) => {
      const parsed = CreateSteelAgentSchema.safeParse({
        name: template.name,
        description: template.description,
        instructions: template.instructions,
        triggerType: template.triggerType,
        cron: template.cron,
        timezone: template.timezone,
        enabled: false,
        ownerId: 'ckw1user0000ab7d3k1e5xyz',
        maxToolRounds: template.maxToolRounds,
        tools: template.tools,
      })
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
    },
  )
})

describe('skill templates', () => {
  const builtIn = new Set(BUILT_IN_SKILLS.map((s) => s.slug))

  it('should have unique commands that never shadow a built-in skill', () => {
    const slugs = AI_SKILL_TEMPLATES.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs) expect(builtIn.has(slug), slug).toBe(false)
  })

  it.each(AI_SKILL_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s should only suggest registry tools of its modules or the platform',
    (_id, template) => {
      expect(template.toolNames.length).toBeGreaterThan(0)
      for (const name of template.toolNames) {
        const tool = toolByName.get(name)
        expect(tool, name).toBeDefined()
        if (tool?.module && template.modules.length > 0) {
          expect(template.modules).toContain(tool.module)
        }
      }
    },
  )

  it.each(AI_SKILL_TEMPLATES.map((t) => [t.id, t] as const))(
    '%s should pass the create schema in the workspace scope',
    (_id, template) => {
      const parsed = CreateAiSkillSchema.safeParse({
        scope: 'WORKSPACE',
        slug: template.slug,
        name: template.name,
        description: template.description,
        instructions: template.instructions,
        mode: template.mode,
        toolNames: template.toolNames,
      })
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true)
    },
  )
})
