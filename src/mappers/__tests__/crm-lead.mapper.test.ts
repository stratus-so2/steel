import { describe, expect, it } from 'vitest'
import {
  createFakeCrmLead,
  createFakeCrmLeadRoutingRule,
  createFakeCrmLeadScoringRule,
} from '@/src/__tests__/factories/crm-lead.factory'
import {
  toCrmLeadDTO,
  toCrmLeadRoutingRuleDTO,
  toCrmLeadScoringRuleDTO,
} from '../crm-lead.mapper'

describe('toCrmLeadDTO()', () => {
  it('should map all fields correctly', () => {
    const lead = createFakeCrmLead({ id: 'l-1', name: 'Jane', score: 25 })
    const dto = toCrmLeadDTO(lead)
    expect(dto.id).toBe('l-1')
    expect(dto.score).toBe(25)
  })
})

describe('toCrmLeadScoringRuleDTO()', () => {
  it('should map all fields correctly', () => {
    const rule = createFakeCrmLeadScoringRule({ id: 'r-1', points: 15 })
    const dto = toCrmLeadScoringRuleDTO(rule)
    expect(dto.id).toBe('r-1')
    expect(dto.points).toBe(15)
  })
})

describe('toCrmLeadRoutingRuleDTO()', () => {
  it('should map all fields correctly', () => {
    const rule = createFakeCrmLeadRoutingRule({ id: 'rr-1', ownerId: 'u1' })
    const dto = toCrmLeadRoutingRuleDTO(rule)
    expect(dto.id).toBe('rr-1')
    expect(dto.ownerId).toBe('u1')
  })
})
