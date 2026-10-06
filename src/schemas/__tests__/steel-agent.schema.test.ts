import { describe, expect, it } from 'vitest'
import {
  ApproveSteelAgentActionSchema,
  CreateSteelAgentSchema,
  ListSteelAgentRunsQuerySchema,
  UpdateSteelAgentSchema,
} from '../steel-agent.schema'

const base = {
  name: 'Triagem',
  instructions: 'Faça a triagem',
  triggerType: 'MANUAL',
  ownerId: 'u1',
}

describe('CreateSteelAgentSchema', () => {
  it('should apply defaults (approval mode, enabled, 8 rounds)', () => {
    const parsed = CreateSteelAgentSchema.parse({
      ...base,
      tools: [{ toolName: 'crm_create_task' }],
    })
    expect(parsed).toEqual(
      expect.objectContaining({
        enabled: true,
        maxToolRounds: 8,
        timezone: 'America/Sao_Paulo',
        tools: [{ toolName: 'crm_create_task', mode: 'APPROVAL' }],
      }),
    )
    expect(CreateSteelAgentSchema.parse(base).tools).toEqual([])
  })

  it('should require a valid cron for SCHEDULE and an event for EVENT', () => {
    const noCron = CreateSteelAgentSchema.safeParse({
      ...base,
      triggerType: 'SCHEDULE',
    })
    expect(noCron.success).toBe(false)
    expect(noCron.error?.issues[0].path).toEqual(['cron'])

    expect(
      CreateSteelAgentSchema.safeParse({
        ...base,
        triggerType: 'SCHEDULE',
        cron: '*/15 * * * *',
      }).success,
    ).toBe(true)

    const noEvent = CreateSteelAgentSchema.safeParse({
      ...base,
      triggerType: 'EVENT',
    })
    expect(noEvent.error?.issues[0].path).toEqual(['eventKey'])
    expect(
      CreateSteelAgentSchema.safeParse({
        ...base,
        triggerType: 'EVENT',
        eventKey: 'crm.lead.created',
      }).success,
    ).toBe(true)
    expect(
      CreateSteelAgentSchema.safeParse({
        ...base,
        triggerType: 'EVENT',
        eventKey: 'nope',
      }).success,
    ).toBe(false)
  })

  it('should reject duplicated and malformed tools, and bad limits', () => {
    expect(
      CreateSteelAgentSchema.safeParse({
        ...base,
        tools: [{ toolName: 'a_b' }, { toolName: 'a_b' }],
      }).success,
    ).toBe(false)
    expect(
      CreateSteelAgentSchema.safeParse({
        ...base,
        tools: [{ toolName: 'Bad-Name' }],
      }).success,
    ).toBe(false)
    expect(
      CreateSteelAgentSchema.safeParse({ ...base, maxToolRounds: 21 }).success,
    ).toBe(false)
    expect(
      CreateSteelAgentSchema.safeParse({ ...base, name: ' ' }).success,
    ).toBe(false)
  })
})

describe('other steel agent schemas', () => {
  it('should require at least one field on update', () => {
    expect(UpdateSteelAgentSchema.safeParse({}).success).toBe(false)
    expect(UpdateSteelAgentSchema.safeParse({ enabled: false }).success).toBe(
      true,
    )
  })

  it('should parse approve body and runs query', () => {
    expect(ApproveSteelAgentActionSchema.parse({})).toEqual({})
    expect(ListSteelAgentRunsQuerySchema.parse({})).toEqual({ limit: 20 })
    expect(
      ListSteelAgentRunsQuerySchema.parse({ limit: '5', status: 'FAILED' }),
    ).toEqual({ limit: 5, status: 'FAILED' })
    expect(
      ListSteelAgentRunsQuerySchema.safeParse({ limit: '0' }).success,
    ).toBe(false)
  })
})
