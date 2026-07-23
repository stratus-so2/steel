import { describe, expect, it } from 'vitest'
import { ListCrmActivitiesSchema } from '../crm-activity.schema'

describe('ListCrmActivitiesSchema', () => {
  it('should accept an empty payload', () => {
    expect(ListCrmActivitiesSchema.safeParse({}).success).toBe(true)
  })

  it('should accept optional filters', () => {
    expect(
      ListCrmActivitiesSchema.safeParse({ opportunityId: 'o1' }).success,
    ).toBe(true)
  })
})
