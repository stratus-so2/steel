import { describe, expect, it } from 'vitest'
import {
  CreateCrmWorkflowSchema,
  CrmWorkflowDefinitionSchema,
  UpdateCrmWorkflowDraftSchema,
  UpdateCrmWorkflowSchema,
} from '../crm-workflow.schema'

describe('CreateCrmWorkflowSchema', () => {
  it('should accept a name-only payload', () => {
    expect(
      CreateCrmWorkflowSchema.safeParse({ name: 'Boas-vindas' }).success,
    ).toBe(true)
  })

  it('should reject an empty name', () => {
    expect(CreateCrmWorkflowSchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('UpdateCrmWorkflowSchema', () => {
  it('should reject an empty payload (must update at least one field)', () => {
    expect(UpdateCrmWorkflowSchema.safeParse({}).success).toBe(false)
  })

  it('should leave omitted fields undefined', () => {
    const result = UpdateCrmWorkflowSchema.safeParse({ name: 'Novo nome' })
    expect(result.success).toBe(true)
    expect(result.data?.description).toBeUndefined()
  })
})

describe('CrmWorkflowDefinitionSchema', () => {
  const baseTrigger = {
    id: 'trigger' as const,
    position: { x: 0, y: 0 },
    data: null,
  }

  it('should accept an empty definition (trigger unset, no nodes)', () => {
    const result = CrmWorkflowDefinitionSchema.safeParse({
      trigger: baseTrigger,
      nodes: [],
      edges: [],
    })
    expect(result.success).toBe(true)
  })

  it('should reject a duplicate node id', () => {
    const result = CrmWorkflowDefinitionSchema.safeParse({
      trigger: baseTrigger,
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { type: 'delay', amount: 1, unit: 'minutes' },
        },
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { type: 'delay', amount: 2, unit: 'minutes' },
        },
      ],
      edges: [],
    })
    expect(result.success).toBe(false)
  })

  it('should reject an edge pointing to an unknown node', () => {
    const result = CrmWorkflowDefinitionSchema.safeParse({
      trigger: baseTrigger,
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: { type: 'delay', amount: 1, unit: 'minutes' },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger', target: 'ghost' }],
    })
    expect(result.success).toBe(false)
  })

  it('should accept a valid trigger + node + edge graph', () => {
    const result = CrmWorkflowDefinitionSchema.safeParse({
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'n1',
          position: { x: 200, y: 0 },
          data: {
            type: 'create-record',
            entity: 'task',
            fields: { title: 'x' },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger', target: 'n1' }],
    })
    expect(result.success).toBe(true)
  })

  it('should reject an unknown node type', () => {
    const result = CrmWorkflowDefinitionSchema.safeParse({
      trigger: baseTrigger,
      nodes: [
        { id: 'n1', position: { x: 0, y: 0 }, data: { type: 'do-magic' } },
      ],
      edges: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmWorkflowDraftSchema', () => {
  it('should require a full valid definition', () => {
    const result = UpdateCrmWorkflowDraftSchema.safeParse({
      definition: {
        trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
        nodes: [],
        edges: [],
      },
    })
    expect(result.success).toBe(true)
  })

  it('should reject a missing definition', () => {
    expect(UpdateCrmWorkflowDraftSchema.safeParse({}).success).toBe(false)
  })
})
