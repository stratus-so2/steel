import { describe, expect, it } from 'vitest'
import {
  CreateCrmWorkflowSchema,
  UpdateCrmWorkflowSchema,
} from '../crm-workflow.schema'

describe('CreateCrmWorkflowSchema', () => {
  it('should reject a definition with no nodes', () => {
    expect(
      CreateCrmWorkflowSchema.safeParse({
        name: 'Boas-vindas',
        triggerType: 'MANUAL',
        definition: { nodes: [] },
      }).success,
    ).toBe(false)
  })

  it('should reject an unknown node type', () => {
    expect(
      CreateCrmWorkflowSchema.safeParse({
        name: 'Boas-vindas',
        triggerType: 'MANUAL',
        definition: {
          nodes: [{ id: 'n1', type: 'DO_MAGIC', config: {} }],
        },
      }).success,
    ).toBe(false)
  })

  it('should accept a valid sequential definition', () => {
    expect(
      CreateCrmWorkflowSchema.safeParse({
        name: 'Boas-vindas',
        triggerType: 'MANUAL',
        definition: {
          nodes: [
            {
              id: 'n1',
              type: 'CREATE_TASK',
              config: { title: 'Ligar para o lead' },
            },
          ],
        },
      }).success,
    ).toBe(true)
  })
})

describe('UpdateCrmWorkflowSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmWorkflowSchema.safeParse({}).success).toBe(true)
  })

  it('should leave omitted fields undefined', () => {
    const result = UpdateCrmWorkflowSchema.safeParse({ name: 'Novo nome' })
    expect(result.success).toBe(true)
    expect(result.data?.description).toBeUndefined()
    expect(result.data?.definition).toBeUndefined()
  })
})
