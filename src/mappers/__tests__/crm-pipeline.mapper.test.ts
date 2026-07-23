import { describe, expect, it } from 'vitest'
import {
  createFakeCrmPipeline,
  createFakeCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { toCrmPipelineDTO, toCrmPipelineStageDTO } from '../crm-pipeline.mapper'

describe('toCrmPipelineDTO()', () => {
  it('should map all fields correctly', () => {
    const pipeline = createFakeCrmPipeline({
      id: 'pl-1',
      name: 'Vendas',
      isDefault: true,
    })

    const dto = toCrmPipelineDTO(pipeline)

    expect(dto.id).toBe('pl-1')
    expect(dto.name).toBe('Vendas')
    expect(dto.isDefault).toBe(true)
  })
})

describe('toCrmPipelineStageDTO()', () => {
  it('should map all fields correctly', () => {
    const stage = createFakeCrmPipelineStage({
      id: 'stg-1',
      name: 'Qualificação',
      probability: 30,
      category: 'OPEN',
    })

    const dto = toCrmPipelineStageDTO(stage)

    expect(dto.id).toBe('stg-1')
    expect(dto.name).toBe('Qualificação')
    expect(dto.probability).toBe(30)
    expect(dto.category).toBe('OPEN')
  })
})
