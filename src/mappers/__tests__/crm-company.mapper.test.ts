import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { createFakeCrmCompany } from '@/src/__tests__/factories/crm-company.factory'
import { toCrmCompanyDTO } from '../crm-company.mapper'

describe('toCrmCompanyDTO()', () => {
  it('should map all fields correctly', () => {
    const company = createFakeCrmCompany({
      id: 'c-1',
      name: 'Acme',
      arr: new Prisma.Decimal(1500),
      icp: true,
    })

    const dto = toCrmCompanyDTO(company)

    expect(dto.id).toBe('c-1')
    expect(dto.name).toBe('Acme')
    expect(dto.icp).toBe(true)
    expect(dto.arr).toBe(1500)
  })

  it('should serialize createdAt/updatedAt as ISO strings', () => {
    const created = new Date('2026-01-15T10:30:00.000Z')
    const updated = new Date('2026-01-15T08:00:00.000Z')
    const company = createFakeCrmCompany({
      createdAt: created,
      updatedAt: updated,
    })

    const dto = toCrmCompanyDTO(company)

    expect(dto.createdAt).toBe('2026-01-15T10:30:00.000Z')
    expect(dto.updatedAt).toBe('2026-01-15T08:00:00.000Z')
  })

  it('should default address and arr to null when absent', () => {
    const company = createFakeCrmCompany({ address: null, arr: null })

    const dto = toCrmCompanyDTO(company)

    expect(dto.address).toBeNull()
    expect(dto.arr).toBeNull()
  })
})
