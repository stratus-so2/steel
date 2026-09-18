import { describe, expect, it } from 'vitest'
import {
  createFakeChangelogItem,
  createFakeChangelogRecipient,
  createFakeChangelogWithCounts,
  createFakeChangelogWithDetails,
} from '@/src/__tests__/factories/changelog.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import {
  toChangelogDetailDTO,
  toChangelogSummaryDTO,
  toChangelogUserSearchResultDTO,
} from '../changelog.mapper'

describe('toChangelogSummaryDTO()', () => {
  it('should count total, sent and failed recipients', () => {
    const changelog = createFakeChangelogWithCounts({ id: 'cl1' }, [
      { status: 'SENT' },
      { status: 'SENT' },
      { status: 'FAILED' },
      { status: 'PENDING' },
    ])

    const dto = toChangelogSummaryDTO(changelog)

    expect(dto).toMatchObject({
      id: 'cl1',
      recipientCount: 4,
      sentCount: 2,
      failedCount: 1,
    })
    expect(dto.createdAt).toBe(changelog.createdAt.toISOString())
  })
})

describe('toChangelogDetailDTO()', () => {
  it('should map items and recipients, serializing sentAt when present', () => {
    const sentAt = new Date('2026-09-01T12:00:00.000Z')
    const changelog = createFakeChangelogWithDetails(
      { id: 'cl1', status: 'DONE' },
      [createFakeChangelogItem({ id: 'i1', title: 'Novo', position: 0 })],
      [
        createFakeChangelogRecipient({ id: 'r1', status: 'SENT', sentAt }),
        createFakeChangelogRecipient({
          id: 'r2',
          status: 'FAILED',
          errorMessage: 'bounce',
        }),
      ],
    )

    const dto = toChangelogDetailDTO(changelog)

    expect(dto.items).toEqual([
      {
        id: 'i1',
        title: 'Novo',
        body: changelog.items[0].body,
        imageUrl: null,
        position: 0,
      },
    ])
    expect(dto.recipients[0]).toMatchObject({
      id: 'r1',
      status: 'SENT',
      sentAt: sentAt.toISOString(),
    })
    expect(dto.recipients[1]).toMatchObject({
      id: 'r2',
      sentAt: null,
      errorMessage: 'bounce',
    })
    expect(dto).toMatchObject({
      status: 'DONE',
      recipientCount: 2,
      sentCount: 1,
      failedCount: 1,
    })
  })
})

describe('toChangelogUserSearchResultDTO()', () => {
  it('should expose only the public user fields', () => {
    const user = createFakeUser({
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      image: null,
    })

    expect(toChangelogUserSearchResultDTO(user)).toEqual({
      id: 'u1',
      name: 'Ana',
      email: 'ana@example.com',
      image: null,
    })
  })
})
