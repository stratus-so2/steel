import { describe, expect, it } from 'vitest'
import { CreateWhatsAppBroadcastImportSchema } from '../whatsapp-broadcast-import.schema'

const validPayload = {
  name: 'Lembretes de consulta',
  connectionId: 'conn1',
  templateId: 'tmpl1',
  csv: 'telefone,data_referencia,var_1\n11987654321,2026-08-15,Maria',
}

describe('CreateWhatsAppBroadcastImportSchema', () => {
  it('should accept a valid payload and default sendOffsetHours to 24', () => {
    const result = CreateWhatsAppBroadcastImportSchema.safeParse(validPayload)

    expect(result.success).toBe(true)
    expect(result.data?.sendOffsetHours).toBe(24)
  })

  it('should accept an explicit sendOffsetHours', () => {
    const result = CreateWhatsAppBroadcastImportSchema.safeParse({
      ...validPayload,
      sendOffsetHours: 2,
    })

    expect(result.success).toBe(true)
    expect(result.data?.sendOffsetHours).toBe(2)
  })

  it('should reject a missing name', () => {
    const { name, ...rest } = validPayload
    const result = CreateWhatsAppBroadcastImportSchema.safeParse(rest)

    expect(result.success).toBe(false)
  })

  it('should reject an empty csv', () => {
    const result = CreateWhatsAppBroadcastImportSchema.safeParse({
      ...validPayload,
      csv: '',
    })

    expect(result.success).toBe(false)
  })

  it('should reject a negative sendOffsetHours', () => {
    const result = CreateWhatsAppBroadcastImportSchema.safeParse({
      ...validPayload,
      sendOffsetHours: -1,
    })

    expect(result.success).toBe(false)
  })
})
