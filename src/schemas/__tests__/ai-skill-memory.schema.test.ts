import { describe, expect, it } from 'vitest'
import {
  CreateAiMemorySchema,
  ListAiMemoriesQuerySchema,
  MemoryForgetArgsSchema,
  MemorySaveArgsSchema,
  UpdateAiMemorySchema,
} from '../ai-memory.schema'
import { CreateAiSkillSchema, UpdateAiSkillSchema } from '../ai-skill.schema'

const skill = {
  slug: '/Resumo-Cliente',
  name: ' Resumo ',
  description: 'Resumo do cliente',
  instructions: 'Resuma o cliente.',
}

describe('CreateAiSkillSchema', () => {
  it('applies defaults and normalizes the command', () => {
    expect(CreateAiSkillSchema.parse(skill)).toEqual({
      scope: 'PERSONAL',
      slug: 'resumo-cliente',
      name: 'Resumo',
      description: 'Resumo do cliente',
      instructions: 'Resuma o cliente.',
      mode: null,
      toolNames: [],
      enabled: true,
    })
  })

  it.each([
    { slug: '' },
    { slug: 'meu comando' },
    { slug: 'a_b' },
    { slug: '-ab' },
    { slug: 'a'.repeat(41) },
    { name: '' },
    { description: '' },
    { instructions: 'x'.repeat(8001) },
    { mode: 'TURBO' },
    { toolNames: ['Bad Name'] },
    { toolNames: ['ws_overview', 'ws_overview'] },
    { toolNames: Array.from({ length: 31 }, (_, i) => `tool_${i}`) },
    { scope: 'GLOBAL' },
  ])('rejects %j', (patch) => {
    expect(CreateAiSkillSchema.safeParse({ ...skill, ...patch }).success).toBe(
      false,
    )
  })

  it('accepts a workspace skill with mode and tools', () => {
    const parsed = CreateAiSkillSchema.parse({
      ...skill,
      scope: 'WORKSPACE',
      mode: 'AGENT',
      toolNames: ['ws_overview'],
      enabled: false,
    })
    expect(parsed).toMatchObject({
      scope: 'WORKSPACE',
      mode: 'AGENT',
      enabled: false,
    })
  })
})

describe('UpdateAiSkillSchema', () => {
  it('accepts partial updates', () => {
    expect(UpdateAiSkillSchema.parse({ enabled: false })).toEqual({
      enabled: false,
    })
    expect(UpdateAiSkillSchema.parse({ slug: '/Novo', mode: null })).toEqual({
      slug: 'novo',
      mode: null,
    })
  })

  it('rejects an empty update and the scope', () => {
    expect(UpdateAiSkillSchema.safeParse({}).success).toBe(false)
    expect(
      UpdateAiSkillSchema.parse({ scope: 'WORKSPACE', name: 'x' }),
    ).toEqual({ name: 'x' })
  })
})

describe('memory schemas', () => {
  it('validates the content', () => {
    expect(CreateAiMemorySchema.parse({ content: ' Fato ' })).toEqual({
      scope: 'PERSONAL',
      content: 'Fato',
    })
    expect(CreateAiMemorySchema.safeParse({ content: '  ' }).success).toBe(
      false,
    )
    expect(
      UpdateAiMemorySchema.safeParse({ content: 'x'.repeat(501) }).success,
    ).toBe(false)
    expect(UpdateAiMemorySchema.parse({ content: 'ok' })).toEqual({
      content: 'ok',
    })
  })

  it('parses the list query', () => {
    expect(ListAiMemoriesQuerySchema.parse({})).toEqual({})
    expect(ListAiMemoriesQuerySchema.parse({ q: ' horário ' })).toEqual({
      q: 'horário',
    })
    expect(
      ListAiMemoriesQuerySchema.safeParse({ q: 'x'.repeat(201) }).success,
    ).toBe(false)
  })

  it('upper-cases the tool scope', () => {
    expect(MemorySaveArgsSchema.parse({ content: 'x' }).scope).toBe('PERSONAL')
    expect(
      MemorySaveArgsSchema.parse({ content: 'x', scope: 'WORKSPACE' }).scope,
    ).toBe('WORKSPACE')
    expect(
      MemorySaveArgsSchema.safeParse({ content: 'x', scope: 'team' }).success,
    ).toBe(false)
    expect(MemoryForgetArgsSchema.safeParse({ id: '' }).success).toBe(false)
  })
})
