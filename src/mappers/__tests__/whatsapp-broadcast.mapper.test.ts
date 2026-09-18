import { describe, expect, it } from 'vitest'
import {
  createFakeWhatsAppBroadcastListWithCounts,
  createFakeWhatsAppBroadcastListWithRecipients,
} from '@/src/__tests__/factories/whatsapp-broadcast.factory'
import {
  toWhatsAppBroadcastListDetailDTO,
  toWhatsAppBroadcastListDTO,
} from '../whatsapp-broadcast.mapper'

describe('toWhatsAppBroadcastListDTO()', () => {
  it('should compute recipient/sent/failed counts from the recipients list', () => {
    const list = createFakeWhatsAppBroadcastListWithCounts({ id: 'b1' }, [
      { status: 'SENT' },
      { status: 'SENT' },
      { status: 'FAILED' },
      { status: 'PENDING' },
      { status: 'SKIPPED' },
    ])

    const dto = toWhatsAppBroadcastListDTO(list)

    expect(dto.recipientCount).toBe(5)
    expect(dto.sentCount).toBe(2)
    expect(dto.failedCount).toBe(1)
    expect(dto.skippedCount).toBe(1)
  })

  it('should default counts to zero for an empty broadcast', () => {
    const list = createFakeWhatsAppBroadcastListWithCounts({ id: 'b2' }, [])

    const dto = toWhatsAppBroadcastListDTO(list)

    expect(dto.recipientCount).toBe(0)
    expect(dto.sentCount).toBe(0)
    expect(dto.failedCount).toBe(0)
    expect(dto.skippedCount).toBe(0)
  })
})

describe('toWhatsAppBroadcastListDetailDTO()', () => {
  it('should include per-recipient contact info', () => {
    const list = createFakeWhatsAppBroadcastListWithRecipients({ id: 'b3' }, 2)

    const dto = toWhatsAppBroadcastListDetailDTO(list)

    expect(dto.recipients).toHaveLength(2)
    expect(dto.recipients[0]).toHaveProperty('contactWaId')
    expect(dto.recipientCount).toBe(2)
  })

  it('should serialize scheduling and per-recipient delivery timestamps', () => {
    const scheduledAt = new Date('2026-10-01T12:00:00.000Z')
    const sentAt = new Date('2026-10-01T12:01:00.000Z')
    const list = createFakeWhatsAppBroadcastListWithRecipients(
      { id: 'b4', scheduledAt },
      2,
    )
    list.recipients[0].status = 'SENT'
    list.recipients[0].sentAt = sentAt
    list.recipients[1].status = 'SKIPPED'

    const dto = toWhatsAppBroadcastListDetailDTO(list)
    const summary = toWhatsAppBroadcastListDTO(
      createFakeWhatsAppBroadcastListWithCounts({ scheduledAt }, []),
    )

    expect(dto.scheduledAt).toBe(scheduledAt.toISOString())
    expect(summary.scheduledAt).toBe(scheduledAt.toISOString())
    expect(dto.recipients[0].sentAt).toBe(sentAt.toISOString())
    expect(dto.recipients[1].sentAt).toBeNull()
    expect(dto.sentCount).toBe(1)
    expect(dto.skippedCount).toBe(1)
    expect(dto.failedCount).toBe(0)
  })
})
