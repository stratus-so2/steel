import { describe, expect, it } from 'vitest'
import { createFakeProfile } from '@/src/__tests__/factories/profile.factory'
import { toProfileDTO } from '../profile.mapper'

describe('toProfileDTO()', () => {
  it('should map all fields correctly', () => {
    const profile = createFakeProfile({
      id: 'p1',
      name: 'Vendedor',
      isSystem: false,
      systemKey: null,
      permissions: { companies: ['VIEW', 'EDIT'] },
    })
    const dto = toProfileDTO(profile)
    expect(dto).toEqual(
      expect.objectContaining({
        id: 'p1',
        name: 'Vendedor',
        isSystem: false,
        systemKey: null,
        permissions: { companies: ['VIEW', 'EDIT'] },
      }),
    )
  })

  it('should serialize dates as ISO strings', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const profile = createFakeProfile({ createdAt })
    expect(toProfileDTO(profile).createdAt).toBe(createdAt.toISOString())
  })
})
