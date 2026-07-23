import { describe, expect, it } from 'vitest'
import {
  CreateCrmPipelineSchema,
  CreateCrmPipelineStageSchema,
  ReorderCrmPipelineStagesSchema,
  ReorderCrmPipelinesSchema,
  UpdateCrmPipelineSchema,
  UpdateCrmPipelineStageSchema,
} from '../crm-pipeline.schema'

describe('CreateCrmPipelineSchema', () => {
  it('should default isDefault to false', () => {
    const result = CreateCrmPipelineSchema.safeParse({ name: 'Vendas' })
    expect(result.success).toBe(true)
    expect(result.data?.isDefault).toBe(false)
  })

  it('should reject when name is missing', () => {
    const result = CreateCrmPipelineSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmPipelineSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmPipelineSchema.safeParse({}).success).toBe(true)
  })
})

describe('ReorderCrmPipelinesSchema', () => {
  it('should reject an empty orderedIds array', () => {
    expect(
      ReorderCrmPipelinesSchema.safeParse({ orderedIds: [] }).success,
    ).toBe(false)
  })
})

describe('CreateCrmPipelineStageSchema', () => {
  it('should default probability to 0 and category to OPEN', () => {
    const result = CreateCrmPipelineStageSchema.safeParse({ name: 'Novo' })
    expect(result.success).toBe(true)
    expect(result.data?.probability).toBe(0)
    expect(result.data?.category).toBe('OPEN')
  })

  it('should reject probability above 100', () => {
    const result = CreateCrmPipelineStageSchema.safeParse({
      name: 'Novo',
      probability: 150,
    })
    expect(result.success).toBe(false)
  })

  it('should reject an invalid category', () => {
    const result = CreateCrmPipelineStageSchema.safeParse({
      name: 'Novo',
      category: 'INVALID',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmPipelineStageSchema', () => {
  it('should accept a partial payload', () => {
    expect(
      UpdateCrmPipelineStageSchema.safeParse({ probability: 50 }).success,
    ).toBe(true)
  })
})

describe('ReorderCrmPipelineStagesSchema', () => {
  it('should accept a non-empty orderedIds array', () => {
    expect(
      ReorderCrmPipelineStagesSchema.safeParse({ orderedIds: ['a'] }).success,
    ).toBe(true)
  })
})
