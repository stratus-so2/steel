import { describe, expect, it } from 'vitest'
import { createFakeCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { toCrmCompetitorDTO } from '../crm-competitor.mapper'

describe('toCrmCompetitorDTO()', () => {
  it('should map all fields correctly', () => {
    const competitor = createFakeCrmCompetitor({
      id: 'c1',
      platform: 'YOUTUBE',
      handle: '@rival',
    })
    const dto = toCrmCompetitorDTO(competitor)
    expect(dto.id).toBe('c1')
    expect(dto.platform).toBe('YOUTUBE')
    expect(dto.handle).toBe('@rival')
  })

  it('should serialize dates as ISO strings', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    const competitor = createFakeCrmCompetitor({ createdAt })
    expect(toCrmCompetitorDTO(competitor).createdAt).toBe(
      createdAt.toISOString(),
    )
  })
})
