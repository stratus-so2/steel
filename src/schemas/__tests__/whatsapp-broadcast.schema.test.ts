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

  describe('media', () => {
    const media = {
      mediaUrl: 'https://steel.test/media/ws/abc.mp4',
      mediaMimeType: 'video/mp4',
      mediaFileName: 'promo.mp4',
      mediaSizeBytes: 2 * 1024 * 1024,
    }

    it('should accept a supported media file', () => {
      expect(
        CreateWhatsAppBroadcastSchema.safeParse({ ...valid, ...media }).success,
      ).toBe(true)
    })

    it('should require the mime type when a media URL is sent', () => {
      const result = CreateWhatsAppBroadcastSchema.safeParse({
        ...valid,
        mediaUrl: media.mediaUrl,
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message).toBe(
        'Informe o tipo do arquivo de mídia',
      )
    })

    it('should reject unsupported types and oversized images in pt-BR', () => {
      const unsupported = CreateWhatsAppBroadcastSchema.safeParse({
        ...valid,
        ...media,
        mediaMimeType: 'application/zip',
      })
      expect(unsupported.error?.issues[0].message).toMatch(
        /Tipo de arquivo não suportado/,
      )

      const tooBig = CreateWhatsAppBroadcastSchema.safeParse({
        ...valid,
        ...media,
        mediaMimeType: 'image/png',
        mediaSizeBytes: 6 * 1024 * 1024,
      })
      expect(tooBig.error?.issues[0].message).toBe(
        'Imagem muito grande para transmissão. Máximo de 5 MB.',
      )
    })
  })
})
