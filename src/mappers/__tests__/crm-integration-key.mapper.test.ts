import { describe, expect, it } from 'vitest'
import { createFakeCrmIntegrationKey } from '@/src/__tests__/factories/crm-integration-key.factory'
import { toCrmIntegrationKeyDTO } from '../crm-integration-key.mapper'

describe('toCrmIntegrationKeyDTO()', () => {
  it('should map all fields and never expose the key hash', () => {
    const key = createFakeCrmIntegrationKey({
      id: 'k-1',
      prefix: 'crm_live_ab',
    })
    const dto = toCrmIntegrationKeyDTO(key)
    expect(dto.id).toBe('k-1')
    expect(dto.prefix).toBe('crm_live_ab')
    expect(dto).not.toHaveProperty('keyHash')
  })
})
