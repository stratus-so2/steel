import { describe, expect, it } from 'vitest'
import { createFakeCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import {
  toCrmCompetitorDTO,
  toCrmCompetitorIdeaSetDTO,
  toCrmCompetitorMetricSnapshotDTO,
} from '../crm-competitor.mapper'

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

  it('should map a null lastSyncedAt to null', () => {
    const competitor = createFakeCrmCompetitor({ lastSyncedAt: null })
    expect(toCrmCompetitorDTO(competitor).lastSyncedAt).toBeNull()
  })

  it('should serialize a non-null lastSyncedAt as an ISO string', () => {
    const lastSyncedAt = new Date('2026-02-01T00:00:00Z')
    const competitor = createFakeCrmCompetitor({ lastSyncedAt })
    expect(toCrmCompetitorDTO(competitor).lastSyncedAt).toBe(
      lastSyncedAt.toISOString(),
    )
  })
})

describe('toCrmCompetitorMetricSnapshotDTO()', () => {
  it('should map all fields correctly', () => {
    const capturedAt = new Date('2026-01-15T00:00:00Z')
    const dto = toCrmCompetitorMetricSnapshotDTO({
      id: 's1',
      competitorId: 'c1',
      followersCount: 1000,
      postsCount: 42,
      capturedAt,
    })
    expect(dto).toEqual({
      id: 's1',
      followersCount: 1000,
      postsCount: 42,
      capturedAt: capturedAt.toISOString(),
    })
  })
})

describe('toCrmCompetitorIdeaSetDTO()', () => {
  const idea = {
    title: 'Bastidores',
    format: 'REELS',
    hook: 'Gancho',
    caption: 'Legenda',
    rationale: 'Motivo',
    hashtags: ['fibra'],
  }
  const createdAt = new Date('2026-10-05T12:00:00Z')

  it('should map a stored idea set', () => {
    expect(
      toCrmCompetitorIdeaSetDTO({
        id: 'set1',
        competitorId: 'c1',
        range: '7d',
        ideas: [idea],
        modelKey: 'openai:gpt',
        createdById: null,
        createdAt,
      }),
    ).toEqual({
      id: 'set1',
      competitorId: 'c1',
      range: '7d',
      ideas: [idea],
      modelKey: 'openai:gpt',
      createdById: null,
      createdAt: createdAt.toISOString(),
    })
  })

  it('should fall back to an empty list and 30d for rows off the contract', () => {
    const dto = toCrmCompetitorIdeaSetDTO({
      id: 'set1',
      competitorId: 'c1',
      range: 'bogus',
      ideas: { not: 'a list' },
      modelKey: 'openai:gpt',
      createdById: 'u1',
      createdAt,
    })
    expect(dto.ideas).toEqual([])
    expect(dto.range).toBe('30d')
  })
})
