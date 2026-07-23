import { describe, expect, it } from 'vitest'
import {
  createFakeCrmScheduledPost,
  createFakeCrmScheduledPostTarget,
  createFakeCrmSocialConnection,
} from '@/src/__tests__/factories/crm-social.factory'
import {
  toCrmScheduledPostDTO,
  toCrmSocialConnectionDTO,
} from '../crm-social.mapper'

describe('toCrmSocialConnectionDTO()', () => {
  it('should map all fields correctly', () => {
    const connection = createFakeCrmSocialConnection({
      id: 'c-1',
      platform: 'TIKTOK',
    })
    const dto = toCrmSocialConnectionDTO(connection)
    expect(dto.id).toBe('c-1')
    expect(dto.platform).toBe('TIKTOK')
  })
})

describe('toCrmScheduledPostDTO()', () => {
  it('should include mapped targets when present', () => {
    const target = createFakeCrmScheduledPostTarget({ id: 't-1' })
    const post = createFakeCrmScheduledPost({ id: 'p-1' })
    const dto = toCrmScheduledPostDTO({ ...post, targets: [target] })
    expect(dto.id).toBe('p-1')
    expect(dto.targets).toHaveLength(1)
    expect(dto.targets?.[0].id).toBe('t-1')
  })
})
