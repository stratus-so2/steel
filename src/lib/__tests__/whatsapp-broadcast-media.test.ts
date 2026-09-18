import { describe, expect, it } from 'vitest'
import {
  fileExtension,
  resolveBroadcastMediaKind,
  validateBroadcastMedia,
} from '@/src/lib/whatsapp/broadcast-media'

describe('broadcast media rules', () => {
  it('should map mime types to the WhatsApp message kind', () => {
    expect(resolveBroadcastMediaKind({ mimeType: 'image/png' })).toBe('IMAGE')
    expect(resolveBroadcastMediaKind({ mimeType: 'video/mp4' })).toBe('VIDEO')
    expect(
      resolveBroadcastMediaKind({ mimeType: 'audio/ogg; codecs=opus' }),
    ).toBe('AUDIO')
    expect(resolveBroadcastMediaKind({ mimeType: 'application/pdf' })).toBe(
      'DOCUMENT',
    )
  })

  it('should fall back to the file name or URL extension (legacy lists)', () => {
    expect(
      resolveBroadcastMediaKind({
        url: 'https://cdn/media/ws/abc.mp4?x=1',
      }),
    ).toBe('VIDEO')
    expect(
      resolveBroadcastMediaKind({
        fileName: 'Tabela de preços.xlsx',
        url: 'https://cdn/media/ws/abc.bin',
      }),
    ).toBe('DOCUMENT')
    expect(resolveBroadcastMediaKind({ url: 'https://cdn/x.bin' })).toBeNull()
  })

  it('should extract extensions safely', () => {
    expect(fileExtension('a/b/c.JPG')).toBe('jpg')
    expect(fileExtension('https://x/y.pdf#page=2')).toBe('pdf')
    expect(fileExtension('.hidden')).toBeNull()
    expect(fileExtension('noext')).toBeNull()
  })

  it('should reject unsupported types with a pt-BR message', () => {
    expect(validateBroadcastMedia({ mimeType: 'image/webp' })).toMatch(
      /Tipo de arquivo não suportado/,
    )
    expect(validateBroadcastMedia({ mimeType: 'application/zip' })).toMatch(
      /não suportado/,
    )
  })

  it('should enforce the per-kind size limits', () => {
    expect(
      validateBroadcastMedia({
        mimeType: 'image/jpeg',
        sizeBytes: 6 * 1024 * 1024,
      }),
    ).toBe('Imagem muito grande para transmissão. Máximo de 5 MB.')
    expect(
      validateBroadcastMedia({
        mimeType: 'video/mp4',
        sizeBytes: 10 * 1024 * 1024,
      }),
    ).toBeNull()
    expect(
      validateBroadcastMedia({
        mimeType: 'application/pdf',
        sizeBytes: 17 * 1024 * 1024,
      }),
    ).toMatch(/Documento muito grande/)
  })
})
