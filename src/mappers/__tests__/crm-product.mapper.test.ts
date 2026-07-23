import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { createFakeCrmProduct } from '@/src/__tests__/factories/crm-product.factory'
import { toCrmProductDTO } from '../crm-product.mapper'

describe('toCrmProductDTO()', () => {
  it('should map all fields correctly and convert unitPrice to number', () => {
    const product = createFakeCrmProduct({
      id: 'prod-1',
      name: 'Plano Pro',
      unitPrice: new Prisma.Decimal(199.9),
    })

    const dto = toCrmProductDTO(product)

    expect(dto.id).toBe('prod-1')
    expect(dto.name).toBe('Plano Pro')
    expect(dto.unitPrice).toBe(199.9)
  })
})
