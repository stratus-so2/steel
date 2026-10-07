import { describe, expect, it } from 'vitest'
import {
  ArchiveReadNotificationsSchema,
  MarkNotificationsReadSchema,
  NOTIFICATION_FOLDERS,
  NotificationBulkActionSchema,
  NotificationListQuerySchema,
  SnoozeNotificationsSchema,
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

describe('inbox quick actions (schemas)', () => {
  it('should offer the snoozed folder', () => {
    expect(NOTIFICATION_FOLDERS).toContain('snoozed')
    expect(
      NotificationListQuerySchema.parse({ folder: 'snoozed' }).folder,
    ).toBe('snoozed')
  })

  it('should accept the quick filters and reject unknown ones', () => {
    expect(NotificationListQuerySchema.parse({ quick: 'mentions' }).quick).toBe(
      'mentions',
    )
    expect(NotificationListQuerySchema.parse({ quick: 'assigned' }).quick).toBe(
      'assigned',
    )
    expect(
      NotificationListQuerySchema.safeParse({ quick: 'vip' }).success,
    ).toBe(false)
  })

  it('should scope "mark all as read" by module and kind', () => {
    expect(
      MarkNotificationsReadSchema.parse({
        module: 'CRM',
        kind: 'CRM_LEAD_ASSIGNED',
      }),
    ).toEqual({ module: 'CRM', kind: 'CRM_LEAD_ASSIGNED' })
    expect(
      MarkNotificationsReadSchema.safeParse({ module: 'ERP' }).success,
    ).toBe(false)
    expect(MarkNotificationsReadSchema.safeParse({ kind: '' }).success).toBe(
      false,
    )
  })

  it('should validate "archive all read"', () => {
    expect(ArchiveReadNotificationsSchema.parse({})).toEqual({})
    expect(
      ArchiveReadNotificationsSchema.parse({ module: 'SERVICE_DESK' }),
    ).toEqual({ module: 'SERVICE_DESK' })
    expect(
      ArchiveReadNotificationsSchema.safeParse({ kind: 'x'.repeat(65) })
        .success,
    ).toBe(false)
  })

  it('should validate the snooze presets and ids', () => {
    for (const preset of ['1h', '3h', 'tomorrow', 'next-week']) {
      expect(
        SnoozeNotificationsSchema.safeParse({ ids: ['n1'], preset }).success,
      ).toBe(true)
    }
    const invalid = SnoozeNotificationsSchema.safeParse({
      ids: ['n1'],
      preset: '2d',
    })
    expect(invalid.success).toBe(false)
    expect(invalid.error?.issues[0].message).toBe('Opção de adiamento inválida')
    expect(
      SnoozeNotificationsSchema.safeParse({ ids: [], preset: '1h' }).success,
    ).toBe(false)
    expect(
      SnoozeNotificationsSchema.safeParse({
        ids: Array.from({ length: 101 }, (_, i) => `n${i}`),
        preset: '1h',
      }).success,
    ).toBe(false)
  })

  it('should accept the unsnooze action', () => {
    expect(
      NotificationBulkActionSchema.safeParse({
        action: 'unsnooze',
        ids: ['n1'],
      }).success,
    ).toBe(true)
  })
})
