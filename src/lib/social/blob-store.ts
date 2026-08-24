import { randomBytes } from 'node:crypto'
import { ensureRedisConnected } from '@/src/lib/redis'

/**
 * Storage no Redis para servir bytes temporariamente como URL pública. É o
 * que permite o upload de imagem no Instagram (o Graph API exige
 * `image_url` HTTP, não aceita upload direto): o service grava aqui, o
 * Graph baixa, expira-se.
 *
 * Usa Redis (não memória do processo) porque em ambiente multi-instância
 * (várias réplicas atrás do load balancer) o GET que a Graph API dispara
 * pode cair numa réplica diferente da que recebeu o PUT — com um Map local
 * isso vira 404 pra Meta e o publish falha.
 */

type Entry = {
  bytes: Uint8Array
  contentType: string
}

const KEY_PREFIX = 'crm:social:blob:'

/** TTL padrão — janela larga o suficiente para o Graph baixar e publicar. */
const DEFAULT_TTL_MS = 10 * 60_000

/** Grava bytes e devolve um token URL-safe. */
export async function putBlob(
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<string> {
  const client = await ensureRedisConnected()
  const token = randomBytes(24).toString('base64url')
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const payload = JSON.stringify({
    bytes: Buffer.from(buf).toString('base64'),
    contentType,
  })
  await client.setEx(`${KEY_PREFIX}${token}`, Math.ceil(ttlMs / 1000), payload)
  return token
}

/** Lê um blob (sem remover — o provedor pode tentar baixar mais de uma vez). */
export async function readBlob(token: string): Promise<Entry | null> {
  const client = await ensureRedisConnected()
  const raw = await client.get(`${KEY_PREFIX}${token}`)
  if (!raw) return null

  const parsed = JSON.parse(raw) as { bytes: string; contentType: string }
  return {
    bytes: new Uint8Array(Buffer.from(parsed.bytes, 'base64')),
    contentType: parsed.contentType,
  }
}

/** Remove explicitamente — útil ao final do publish para liberar memória. */
export async function removeBlob(token: string): Promise<void> {
  const client = await ensureRedisConnected()
  await client.del(`${KEY_PREFIX}${token}`)
}
