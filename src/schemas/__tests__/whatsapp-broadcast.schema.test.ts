import { describe, expect, it } from 'vitest'
import { CreateWhatsAppBroadcastSchema } from '../whatsapp-broadcast.schema'

const valid = {
  connectionId: 'conn-1',
  name: 'Promoção',
  messageBody: 'Aproveite nossas ofertas!',
  contactIds: ['c1', 'c2'],
}

describe('CreateWhatsAppBroadcastSchema', () => {
  it('should accept a valid broadcast payload', () => {
    expect(CreateWhatsAppBroadcastSchema.safeParse(valid).success).toBe(true)
  })

  it('should reject an empty contactIds list', () => {
    expect(
      CreateWhatsAppBroadcastSchema.safeParse({ ...valid, contactIds: [] })
        .success,
    ).toBe(false)
  })

  it('should reject more than 1000 contacts', () => {
    const contactIds = Array.from({ length: 1001 }, (_, i) => `c${i}`)
    expect(
      CreateWhatsAppBroadcastSchema.safeParse({ ...valid, contactIds }).success,
    ).toBe(false)
  })

  it('should reject a missing connectionId', () => {
    const { connectionId: _connectionId, ...rest } = valid
    expect(CreateWhatsAppBroadcastSchema.safeParse(rest).success).toBe(false)
  })
})
