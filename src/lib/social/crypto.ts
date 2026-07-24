import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { SOCIAL_TOKEN_ENCRYPTION_KEY } from '@/lib/env/server'

/**
 * Cifragem de tokens OAuth em repouso (AES-256-GCM).
 *
 * Formato persistido: `iv.authTag.ciphertext`, cada parte em base64. O IV é
 * aleatório por operação (12 bytes, recomendado para GCM) e o auth tag
 * garante integridade. A chave vem de `SOCIAL_TOKEN_ENCRYPTION_KEY` (base64
 * de 32 bytes).
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const KEY_LENGTH = 32

/** Decodifica e valida a chave; lança se ausente/inválida (chamado sob demanda). */
function getKey(): Buffer {
  if (!SOCIAL_TOKEN_ENCRYPTION_KEY) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY ausente')
  }
  const key = Buffer.from(SOCIAL_TOKEN_ENCRYPTION_KEY, 'base64')
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      'SOCIAL_TOKEN_ENCRYPTION_KEY deve ser base64 de 32 bytes (use `openssl rand -base64 32`)',
    )
  }
  return key
}

/** A cifragem de tokens está disponível? (chave presente e com tamanho certo). */
export function isTokenCryptoConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

/** Cifra um texto plano, retornando `iv.tag.ciphertext` em base64. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.')
}

/** Decifra um valor produzido por `encryptToken`. Lança se adulterado. */
export function decryptToken(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.')
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Token cifrado em formato inválido')
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getKey(),
    Buffer.from(ivPart, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
