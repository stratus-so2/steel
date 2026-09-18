import { describe, expect, it } from 'vitest'
import { MarkNotificationsReadSchema } from '../notification.schema'

describe('MarkNotificationsReadSchema', () => {
  it('should accept an empty body (mark all) and a list of ids', () => {
    expect(MarkNotificationsReadSchema.safeParse({}).success).toBe(true)
    expect(MarkNotificationsReadSchema.safeParse({ ids: ['n1'] }).success).toBe(
      true,
    )
  })

  it('should reject more than 100 ids or empty ids', () => {
    expect(
      MarkNotificationsReadSchema.safeParse({
        ids: Array.from({ length: 101 }, (_, i) => `n${i}`),
      }).success,
    ).toBe(false)
    expect(MarkNotificationsReadSchema.safeParse({ ids: [''] }).success).toBe(
      false,
    )
  })
})
