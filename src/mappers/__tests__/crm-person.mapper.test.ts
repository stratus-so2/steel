import { describe, expect, it } from 'vitest'
import { createFakeCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import { toCrmPersonDTO } from '../crm-person.mapper'

describe('toCrmPersonDTO()', () => {
  it('should map all fields correctly', () => {
    const person = createFakeCrmPerson({
      id: 'p-1',
      name: 'Jane',
      emails: ['jane@acme.com'],
      phones: ['+5511999999999'],
    })

    const dto = toCrmPersonDTO(person)

    expect(dto.id).toBe('p-1')
    expect(dto.name).toBe('Jane')
    expect(dto.emails).toEqual(['jane@acme.com'])
    expect(dto.phones).toEqual(['+5511999999999'])
  })

  it('should serialize createdAt/updatedAt as ISO strings', () => {
    const created = new Date('2026-01-15T10:30:00.000Z')
    const updated = new Date('2026-01-15T08:00:00.000Z')
    const person = createFakeCrmPerson({
      createdAt: created,
      updatedAt: updated,
    })

    const dto = toCrmPersonDTO(person)

    expect(dto.createdAt).toBe('2026-01-15T10:30:00.000Z')
    expect(dto.updatedAt).toBe('2026-01-15T08:00:00.000Z')
  })
})
