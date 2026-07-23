import { describe, expect, it } from 'vitest'
import {
  createFakeCrmWorkflow,
  createFakeCrmWorkflowRun,
  createFakeCrmWorkflowRunStep,
} from '@/src/__tests__/factories/crm-workflow.factory'
import {
  toCrmWorkflowDTO,
  toCrmWorkflowRunDTO,
  toCrmWorkflowRunStepDTO,
} from '../crm-workflow.mapper'

describe('toCrmWorkflowDTO()', () => {
  it('should map all fields correctly', () => {
    const workflow = createFakeCrmWorkflow({ id: 'w-1', status: 'ACTIVE' })
    const dto = toCrmWorkflowDTO(workflow)
    expect(dto.id).toBe('w-1')
    expect(dto.status).toBe('ACTIVE')
    expect(dto.definition.nodes).toHaveLength(1)
  })
})

describe('toCrmWorkflowRunDTO()', () => {
  it('should include mapped steps when present', () => {
    const step = createFakeCrmWorkflowRunStep({ id: 's-1' })
    const run = createFakeCrmWorkflowRun({ id: 'r-1' })
    const dto = toCrmWorkflowRunDTO({ ...run, steps: [step] })
    expect(dto.id).toBe('r-1')
    expect(dto.steps).toHaveLength(1)
    expect(dto.steps?.[0].id).toBe('s-1')
  })
})

describe('toCrmWorkflowRunStepDTO()', () => {
  it('should map all fields correctly', () => {
    const step = createFakeCrmWorkflowRunStep({ id: 's-2', status: 'FAILED' })
    const dto = toCrmWorkflowRunStepDTO(step)
    expect(dto.id).toBe('s-2')
    expect(dto.status).toBe('FAILED')
  })
})
