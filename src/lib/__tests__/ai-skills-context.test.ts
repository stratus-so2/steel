import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeAiSkill } from '@/src/__tests__/factories/ai-skill-memory.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/ai-skill.repository')

import {
  BUILT_IN_SKILLS,
  builtInSkillFromId,
  builtInSkillId,
  findBuiltInSkill,
} from '@/src/lib/ai/context/builtin-skills'
import {
  enabledSkillsFor,
  mergeSkills,
  pickSkillBySlug,
  skillInstructionsForModel,
} from '@/src/lib/ai/context/skill-catalog'
import {
  AI_SKILL_SLUG_PATTERN,
  normalizeSkillSlug,
  parseSkillCommand,
} from '@/src/lib/ai/context/skill-command'
import { getSkillTool } from '@/src/lib/ai/context/skill-tool'
import {
  resolveSkillInvocation,
  SKILLS_CATALOG_MAX,
  skillsCatalogForPrompt,
} from '@/src/lib/ai/context/skills'
import { STEEL_AI_TOOLS } from '@/src/lib/ai/tools'
import { findTool } from '@/src/lib/ai/tools/registry'
import type { AiToolContext } from '@/src/lib/ai/tools/types'
import { AiSkillRepository } from '@/src/repositories/ai-skill.repository'

const repo = vi.mocked(AiSkillRepository)
const ctx: AiToolContext = {
  workspaceId: 'ws1',
  actorId: 'u1',
  source: 'assistant',
}

beforeEach(() => {
  repo.listVisible.mockResolvedValue(ok([]))
})

describe('skill commands', () => {
  it.each([
    ['/my-work', { slug: 'my-work', rest: '' }],
    ['  /SLA  ', { slug: 'sla', rest: '' }],
    ['/follow-ups 14 dias', { slug: 'follow-ups', rest: '14 dias' }],
    ['/inbox\nsó o urgente', { slug: 'inbox', rest: 'só o urgente' }],
  ])('parses %j', (content, expected) => {
    expect(parseSkillCommand(content)).toEqual(expected)
  })

  it.each([
    'olá /my-work',
    '/',
    '/-bad',
    '/my_work',
    'https://x.com/a',
    '/my-work/extra',
  ])('ignores %j', (content) => {
    expect(parseSkillCommand(content)).toBeNull()
  })

  it('normalizes what the user typed in the command field', () => {
    expect(normalizeSkillSlug('  //My-Work ')).toBe('my-work')
  })

  it('validates the slug format', () => {
    for (const ok of ['a', 'my-work', 'resumo-semana', 'x1', 'a'.repeat(40)]) {
      expect(AI_SKILL_SLUG_PATTERN.test(ok)).toBe(true)
    }
    for (const bad of ['', '-a', 'a-', 'A', 'a_b', 'a b', 'a'.repeat(41)]) {
      expect(AI_SKILL_SLUG_PATTERN.test(bad)).toBe(false)
    }
  })
})

describe('built-in skills', () => {
  it('ships the owner-requested commands with valid slugs and known tools', () => {
    expect(BUILT_IN_SKILLS.map((s) => s.slug)).toEqual([
      'my-work',
      'sla',
      'pipeline',
      'follow-ups',
      'inbox',
      'resumo-semana',
    ])
    for (const skill of BUILT_IN_SKILLS) {
      expect(AI_SKILL_SLUG_PATTERN.test(skill.slug)).toBe(true)
      for (const tool of skill.toolNames) expect(findTool(tool)).toBeDefined()
    }
  })

  it('maps built-in ids both ways', () => {
    expect(builtInSkillId('sla')).toBe('builtin:sla')
    expect(builtInSkillFromId('builtin:sla')?.name).toBe('SLA em risco')
    expect(builtInSkillFromId('builtin:nope')).toBeNull()
    expect(builtInSkillFromId('ckskill1')).toBeNull()
    expect(findBuiltInSkill('pipeline')?.slug).toBe('pipeline')
  })
})

describe('skill catalog', () => {
  const personal = createFakeAiSkill({
    id: 'p1',
    scope: 'PERSONAL',
    ownerId: 'u1',
    slug: 'resumo',
    name: 'Meu resumo',
  })
  const shared = createFakeAiSkill({
    id: 'w1',
    scope: 'WORKSPACE',
    ownerId: null,
    slug: 'resumo',
    name: 'Resumo do time',
    toolNames: ['ws_overview'],
  })
  const override = createFakeAiSkill({
    id: 'o1',
    scope: 'WORKSPACE',
    ownerId: null,
    slug: 'sla',
    builtIn: true,
    enabled: false,
  })

  it('merges built-ins, workspace and personal skills with permissions', () => {
    const skills = mergeSkills([personal, shared, override], {
      actorId: 'u1',
      canManageWorkspace: false,
    })
    expect(skills.map((s) => `${s.kind}:${s.slug}`)).toEqual([
      ...BUILT_IN_SKILLS.map((s) => `BUILT_IN:${s.slug}`),
      'WORKSPACE:resumo',
      'PERSONAL:resumo',
    ])
    const sla = skills.find((s) => s.id === 'builtin:sla')
    expect(sla).toMatchObject({ enabled: false, canToggle: false })
    expect(skills.find((s) => s.id === 'w1')).toMatchObject({
      canEdit: false,
      canDelete: false,
    })
    expect(skills.find((s) => s.id === 'p1')).toMatchObject({
      canEdit: true,
      canDelete: true,
    })
  })

  it('prefers personal, then workspace, then built-in for a command', () => {
    const skills = mergeSkills([shared, personal], {
      actorId: 'u1',
      canManageWorkspace: true,
    })
    expect(pickSkillBySlug(skills, 'resumo')?.id).toBe('p1')
    expect(pickSkillBySlug(skills.slice(0, -1), 'resumo')?.id).toBe('w1')
    expect(pickSkillBySlug(skills, 'sla')?.kind).toBe('BUILT_IN')
    expect(pickSkillBySlug(skills, 'nope')).toBeNull()
  })

  it('adds the tool hint to the instructions', () => {
    const [built] = mergeSkills([], {
      actorId: 'u1',
      canManageWorkspace: false,
    })
    expect(skillInstructionsForModel(built)).toContain('Ferramentas sugeridas:')
    const noTools = { ...built, toolNames: [] }
    expect(skillInstructionsForModel(noTools)).toBe(built.instructions)
  })

  it('lists only enabled skills', async () => {
    repo.listVisible.mockResolvedValue(ok([override]))
    const skills = expectOk(await enabledSkillsFor('ws1', 'u1'))
    expect(skills.some((s) => s.slug === 'sla')).toBe(false)
    expect(repo.listVisible).toHaveBeenCalledWith('ws1', 'u1')

    repo.listVisible.mockResolvedValue(err(databaseError('down')))
    expectErr(await enabledSkillsFor('ws1', 'u1'), 'DATABASE_ERROR')
  })
})

describe('resolveSkillInvocation()', () => {
  it('keeps messages without a command untouched', async () => {
    expect(await resolveSkillInvocation(ctx, 'oi')).toEqual({
      skill: null,
      content: 'oi',
    })
    expect(repo.listVisible).not.toHaveBeenCalled()
  })

  it('resolves a built-in and strips the command', async () => {
    const result = await resolveSkillInvocation(ctx, '/follow-ups 14')
    expect(result.content).toBe('14')
    expect(result.skill).toMatchObject({
      id: 'builtin:follow-ups',
      slug: 'follow-ups',
      name: 'Follow-ups pendentes',
    })
    expect(result.skill?.instructions).toContain('Ferramentas sugeridas')
  })

  it('ignores unknown or disabled commands', async () => {
    expect((await resolveSkillInvocation(ctx, '/nope x')).skill).toBeNull()
    repo.listVisible.mockResolvedValue(
      ok([
        createFakeAiSkill({
          scope: 'WORKSPACE',
          slug: 'my-work',
          builtIn: true,
          enabled: false,
        }),
      ]),
    )
    expect(await resolveSkillInvocation(ctx, '/my-work')).toEqual({
      skill: null,
      content: '/my-work',
    })
  })

  it('degrades to no skill when the database fails', async () => {
    repo.listVisible.mockResolvedValue(err(databaseError('down')))
    expect((await resolveSkillInvocation(ctx, '/sla')).skill).toBeNull()
  })
})

describe('skillsCatalogForPrompt()', () => {
  it('lists one entry per command with the description', async () => {
    repo.listVisible.mockResolvedValue(
      ok([
        createFakeAiSkill({
          scope: 'WORKSPACE',
          ownerId: null,
          slug: 'resumo',
          description: 'Do  time',
        }),
        createFakeAiSkill({
          scope: 'PERSONAL',
          ownerId: 'u1',
          slug: 'resumo',
          description: 'Meu',
        }),
      ]),
    )
    const text = await skillsCatalogForPrompt(ctx)
    expect(text).toContain('steel_get_skill')
    expect(text).toContain('- /my-work — ')
    expect(text).toContain('- /resumo — Meu')
    expect(text).not.toContain('Do time')
  })

  it('caps the catalog size', async () => {
    repo.listVisible.mockResolvedValue(
      ok(
        Array.from({ length: 60 }, (_, i) =>
          createFakeAiSkill({ ownerId: 'u1', slug: `skill-${i}` }),
        ),
      ),
    )
    const lines = (await skillsCatalogForPrompt(ctx))
      .split('\n')
      .filter((line) => line.startsWith('- /'))
    expect(lines).toHaveLength(SKILLS_CATALOG_MAX)
  })

  it('is empty when every skill is off', async () => {
    repo.listVisible.mockResolvedValue(
      ok(
        BUILT_IN_SKILLS.map((s) =>
          createFakeAiSkill({
            scope: 'WORKSPACE',
            slug: s.slug,
            builtIn: true,
            enabled: false,
          }),
        ),
      ),
    )
    expect(await skillsCatalogForPrompt(ctx)).toBe('')
  })
})

describe('steel_get_skill tool', () => {
  it('is a platform read tool in the registry', () => {
    expect(STEEL_AI_TOOLS).toContain(getSkillTool)
    expect(getSkillTool).toMatchObject({ module: null, kind: 'READ' })
  })

  it('parses and normalizes the command', () => {
    expect(expectOk(getSkillTool.parse({ slug: '/My-Work' }))).toEqual({
      slug: 'my-work',
    })
    expectErr(getSkillTool.parse({}), 'VALIDATION_ERROR')
    expectErr(
      getSkillTool.parse(undefined as unknown as Record<string, unknown>),
      'VALIDATION_ERROR',
    )
  })

  it('returns the instructions of a visible enabled skill', async () => {
    const out = expectOk(await getSkillTool.execute(ctx, { slug: 'sla' }))
    expect(out.summary).toBe('/sla — SLA em risco')
    expect(out.data).toMatchObject({ slug: 'sla', name: 'SLA em risco' })
  })

  it('fails for an unknown skill or a database error', async () => {
    expectErr(
      await getSkillTool.execute(ctx, { slug: 'nope' }),
      'AI_SKILL_NOT_FOUND',
    )
    repo.listVisible.mockResolvedValue(err(databaseError('down')))
    expectErr(
      await getSkillTool.execute(ctx, { slug: 'sla' }),
      'DATABASE_ERROR',
    )
  })
})
