import { describe, expect, it } from 'vitest'
import { createFakeCrmActivity } from '@/src/__tests__/factories/crm-activity.factory'
import { toCrmActivityDTO } from '../crm-activity.mapper'

describe('toCrmActivityDTO()', () => {
  it('should map all fields correctly', () => {
    const activity = createFakeCrmActivity({ id: 'a-1', action: 'UPDATED' })
    const dto = toCrmActivityDTO(activity)
    expect(dto.id).toBe('a-1')
    expect(dto.action).toBe('UPDATED')
  })
})
