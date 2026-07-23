import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { createFakeCrmQuota } from '@/src/__tests__/factories/crm-quota.factory'
import { toCrmQuotaDTO } from '../crm-quota.mapper'

describe('toCrmQuotaDTO()', () => {
  it('should convert targetAmount to number', () => {
    const quota = createFakeCrmQuota({
      id: 'q-1',
      targetAmount: new Prisma.Decimal(50000),
    })
    const dto = toCrmQuotaDTO(quota)
    expect(dto.id).toBe('q-1')
    expect(dto.targetAmount).toBe(50000)
  })
})
