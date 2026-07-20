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
    ])

    const dto = toWhatsAppBroadcastListDTO(list)

    expect(dto.recipientCount).toBe(4)
    expect(dto.sentCount).toBe(2)
    expect(dto.failedCount).toBe(1)
  })

  it('should default counts to zero for an empty broadcast', () => {
    const list = createFakeWhatsAppBroadcastListWithCounts({ id: 'b2' }, [])

    const dto = toWhatsAppBroadcastListDTO(list)

    expect(dto.recipientCount).toBe(0)
    expect(dto.sentCount).toBe(0)
    expect(dto.failedCount).toBe(0)
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
})
