import { describe, expect, it } from 'vitest'
import {
  MarkNotificationsReadSchema,
  NotificationBulkActionSchema,
  NotificationListQuerySchema,
} from '../notification.schema'

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

describe('NotificationListQuerySchema', () => {
  it('should default to the "all" folder and the standard page size', () => {
    const parsed = NotificationListQuerySchema.parse({})

    expect(parsed).toEqual({ folder: 'all', limit: 25 })
  })

  it('should accept every folder, module, kind, search and cursor', () => {
    const parsed = NotificationListQuerySchema.parse({
      folder: 'archived',
      module: 'SERVICE_DESK',
      kind: 'SD_SLA_BREACHED',
      search: '  sla  ',
      cursor: 'n1',
      limit: '10',
    })

    expect(parsed).toEqual({
      folder: 'archived',
      module: 'SERVICE_DESK',
      kind: 'SD_SLA_BREACHED',
      search: 'sla',
      cursor: 'n1',
      limit: 10,
    })
    expect(NotificationListQuerySchema.parse({ folder: 'unread' }).folder).toBe(
      'unread',
    )
  })

  it('should reject an unknown folder/module, a blank search and a bad limit', () => {
    expect(
      NotificationListQuerySchema.safeParse({ folder: 'spam' }).success,
    ).toBe(false)
    expect(
      NotificationListQuerySchema.safeParse({ module: 'BILLING' }).success,
    ).toBe(false)
    expect(
      NotificationListQuerySchema.safeParse({ search: '   ' }).success,
    ).toBe(false)
    expect(NotificationListQuerySchema.safeParse({ limit: 0 }).success).toBe(
      false,
    )
    expect(NotificationListQuerySchema.safeParse({ limit: 51 }).success).toBe(
      false,
    )
    expect(
      NotificationListQuerySchema.safeParse({ search: 'x'.repeat(201) })
        .success,
    ).toBe(false)
  })
})

describe('NotificationBulkActionSchema', () => {
  it('should accept every e-mail client action with at least one id', () => {
    for (const action of [
      'read',
      'unread',
      'archive',
      'unarchive',
      'delete',
      'restore',
    ] as const) {
      expect(
        NotificationBulkActionSchema.safeParse({ action, ids: ['n1'] }).success,
      ).toBe(true)
    }
  })

  it('should reject an unknown action, no ids or more than 100 ids', () => {
    expect(
      NotificationBulkActionSchema.safeParse({ action: 'spam', ids: ['n1'] })
        .success,
    ).toBe(false)
    expect(
      NotificationBulkActionSchema.safeParse({ action: 'read', ids: [] })
        .success,
    ).toBe(false)
    expect(
      NotificationBulkActionSchema.safeParse({
        action: 'read',
        ids: Array.from({ length: 101 }, (_, i) => `n${i}`),
      }).success,
    ).toBe(false)
  })
})
