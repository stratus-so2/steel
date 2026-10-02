import { createCipheriv, randomBytes } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

const KEY = Buffer.alloc(32, 7)

vi.mock('@/lib/env/server', () => ({
  SOCIAL_TOKEN_ENCRYPTION_KEY: KEY.toString('base64'),
}))

const { decryptToken, encryptToken, isTokenCryptoConfigured } = await import(
  '@/src/lib/social/crypto'
)

/** Monta um payload `iv.tag.ciphertext` com o tamanho de tag pedido. */
function forgePayload(plaintext: string, authTagLength: number): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv, { authTagLength })
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  return [
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join('.')
}

describe('social token crypto', () => {
  it('considera a cifragem configurada com chave de 32 bytes', () => {
    expect(isTokenCryptoConfigured()).toBe(true)
  })

  it('decifra o que cifrou', () => {
    const payload = encryptToken('ya29.token-de-acesso')
    expect(payload).not.toContain('ya29')
    expect(decryptToken(payload)).toBe('ya29.token-de-acesso')
  })

  it('usa um IV novo a cada cifragem', () => {
    expect(encryptToken('mesmo-texto')).not.toBe(encryptToken('mesmo-texto'))
  })

  it('emite auth tag de 16 bytes', () => {
    const [, tagPart] = encryptToken('token').split('.')
    expect(Buffer.from(tagPart, 'base64')).toHaveLength(16)
  })

  it('rejeita payload com partes faltando', () => {
    expect(() => decryptToken('somente-uma-parte')).toThrow(
      'Token cifrado em formato inválido',
    )
  })

  it('rejeita auth tag truncada em vez de aceitar a verificação mais fraca', () => {
    // Sem `authTagLength`, o Node aceitaria esta tag de 4 bytes e a chance de
    // forjar um texto cifrado cairia de 2^128 para 2^32.
    const payload = forgePayload('token', 4)
    expect(Buffer.from(payload.split('.')[1], 'base64')).toHaveLength(4)
    expect(() => decryptToken(payload)).toThrow(
      'Token cifrado em formato inválido',
    )
  })

  it('rejeita IV com tamanho diferente de 12 bytes', () => {
    const [, tagPart, dataPart] = encryptToken('token').split('.')
    const payload = [
      randomBytes(16).toString('base64'),
      tagPart,
      dataPart,
    ].join('.')
    expect(() => decryptToken(payload)).toThrow(
      'Token cifrado em formato inválido',
    )
  })

  it('rejeita texto cifrado adulterado', () => {
    const [ivPart, tagPart, dataPart] = encryptToken('token').split('.')
    const data = Buffer.from(dataPart, 'base64')
    data[0] ^= 0xff
    const payload = [ivPart, tagPart, data.toString('base64')].join('.')
    expect(() => decryptToken(payload)).toThrow()
  })
})
